const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");
const { promisify } = require("util");
const { ethers } = require("ethers");

const execFileAsync = promisify(execFile);

class HardhatServiceError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = "HardhatServiceError";
    this.statusCode = statusCode;
  }
}

class HardhatService {
  constructor(options = {}) {
    this.appRoot = options.appRoot || path.join(__dirname, "..", "..");
    this.hardhatDir = path.join(this.appRoot, "hardhat");
    this.rpcUrl = options.rpcUrl || "http://127.0.0.1:8545";
    this.artifactPath = path.join(
      this.hardhatDir,
      "artifacts",
      "contracts",
      "AtlasXAssetRegistry.sol",
      "AtlasXAssetRegistry.json"
    );
    this.deploymentPath = path.join(this.appRoot, "data", "hardhat-deployment.json");
    this.provider = options.provider || new ethers.JsonRpcProvider(this.rpcUrl);
    this.compilePromise = null;
  }

  readArtifact() {
    if (!fs.existsSync(this.artifactPath)) {
      throw new HardhatServiceError(
        "Contract artifact is missing. Compile the Hardhat project first.",
        409
      );
    }

    return JSON.parse(fs.readFileSync(this.artifactPath, "utf8"));
  }

  readDeployment() {
    if (!fs.existsSync(this.deploymentPath)) {
      return null;
    }

    try {
      const deployment = JSON.parse(fs.readFileSync(this.deploymentPath, "utf8"));
      return ethers.isAddress(deployment.address) ? deployment : null;
    } catch {
      return null;
    }
  }

  saveDeployment(deployment) {
    fs.mkdirSync(path.dirname(this.deploymentPath), { recursive: true });
    fs.writeFileSync(this.deploymentPath, `${JSON.stringify(deployment, null, 2)}\n`, "utf8");
  }

  async rpcRequest(method) {
    const response = await fetch(this.rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params: [] }),
      signal: AbortSignal.timeout(1500),
    });
    const payload = await response.json();
    if (!response.ok || payload.error) {
      throw new Error(payload.error?.message || `Hardhat RPC returned HTTP ${response.status}`);
    }
    return payload.result;
  }

  async getNodeStatus() {
    try {
      const [chainIdHex, blockNumberHex, accounts] = await Promise.all([
        this.rpcRequest("eth_chainId"),
        this.rpcRequest("eth_blockNumber"),
        this.rpcRequest("eth_accounts"),
      ]);

      return {
        online: true,
        chainId: BigInt(chainIdHex).toString(),
        blockNumber: Number(BigInt(blockNumberHex)),
        accountCount: accounts.length,
        accounts,
        deployer: accounts[0] || null,
      };
    } catch {
      return {
        online: false,
        chainId: null,
        blockNumber: null,
        accountCount: 0,
        accounts: [],
        deployer: null,
      };
    }
  }

  async getStatus() {
    const node = await this.getNodeStatus();
    const savedDeployment = this.readDeployment();
    let deployment = null;

    if (node.online && savedDeployment) {
      const code = await this.provider.getCode(savedDeployment.address).catch(() => "0x");
      if (code !== "0x") {
        deployment = savedDeployment;
      }
    }

    return {
      rpcUrl: this.rpcUrl,
      node,
      compiler: {
        version: "0.8.28",
        artifactAvailable: fs.existsSync(this.artifactPath),
      },
      deployment,
      staleDeployment: Boolean(savedDeployment && !deployment),
    };
  }

  async compile() {
    if (!this.compilePromise) {
      const hardhatRoot = path.dirname(require.resolve("hardhat/package.json"));
      const cliPath = path.join(hardhatRoot, "dist", "src", "cli.js");
      this.compilePromise = execFileAsync(process.execPath, [cliPath, "compile"], {
        cwd: this.hardhatDir,
        maxBuffer: 1024 * 1024,
        windowsHide: true,
      });
    }

    try {
      const result = await this.compilePromise;
      return {
        compiled: true,
        output: String(result.stdout || "").trim() || "Compilation complete",
      };
    } finally {
      this.compilePromise = null;
    }
  }

  async requireOnlineNode() {
    const node = await this.getNodeStatus();
    if (!node.online) {
      throw new HardhatServiceError(
        `Hardhat node is offline at ${this.rpcUrl}. Run npm run hardhat:node.`,
        503
      );
    }
    return node;
  }

  async listAccounts() {
    const node = await this.requireOnlineNode();
    const accountDetails = await Promise.all(
      node.accounts.map(async (address) => ({
        address,
        balance: ethers.formatEther(await this.provider.getBalance(address)),
      }))
    );
    return {
      chainId: node.chainId,
      blockNumber: node.blockNumber,
      accounts: node.accounts,
      accountDetails,
    };
  }

  async requireDeployment() {
    await this.requireOnlineNode();
    const deployment = this.readDeployment();
    if (!deployment) {
      throw new HardhatServiceError("Deploy AtlasXAssetRegistry first.", 409);
    }

    const code = await this.provider.getCode(deployment.address);
    if (code === "0x") {
      throw new HardhatServiceError(
        "The saved deployment is not available on this node. Deploy the contract again.",
        409
      );
    }

    return deployment;
  }

  async deploy() {
    const node = await this.requireOnlineNode();
    const artifact = this.readArtifact();
    const signer = await this.provider.getSigner(0);
    const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, signer);
    const contract = await factory.deploy();
    await contract.waitForDeployment();

    const transaction = contract.deploymentTransaction();
    const deployment = {
      contractName: artifact.contractName,
      address: await contract.getAddress(),
      transactionHash: transaction?.hash || null,
      deployer: await signer.getAddress(),
      chainId: node.chainId,
      deployedAt: new Date().toISOString(),
    };

    this.saveDeployment(deployment);
    return deployment;
  }

  async getContract(signer = false) {
    const deployment = await this.requireDeployment();
    const artifact = this.readArtifact();
    const runner = signer ? await this.provider.getSigner(0) : this.provider;
    return new ethers.Contract(deployment.address, artifact.abi, runner);
  }

  async listAssets() {
    const deployment = await this.requireDeployment();
    const contract = await this.getContract();
    const total = Number(await contract.totalAssets());
    const assets = await Promise.all(
      Array.from({ length: total }, async (_, assetId) => {
        const asset = await contract.assetAt(assetId);
        return {
          assetId,
          symbol: asset.symbol,
          name: asset.name,
          metadataUri: asset.metadataUri,
          registrar: asset.registrar,
          registeredAt: Number(asset.registeredAt),
        };
      })
    );

    return { deployment, total, assets };
  }

  async registerAsset({ symbol, name, metadataUri = "" }) {
    const contract = await this.getContract(true);
    const transaction = await contract.registerAsset(symbol, name, metadataUri);
    const receipt = await transaction.wait();
    const result = await this.listAssets();

    return {
      transactionHash: receipt.hash,
      blockNumber: receipt.blockNumber,
      ...result,
    };
  }
}

HardhatService.Error = HardhatServiceError;

module.exports = HardhatService;
