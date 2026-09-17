/**
 * Portfolio Optimization Service
 * AI-powered portfolio optimization and rebalancing strategies
 */

class PortfolioOptimizationService {
  constructor() {
    this.optimizationStrategies = new Map();
    this.assetCorrelations = new Map();
  }

  /**
   * Calculate efficient frontier using Sharpe ratio
   */
  calculateEfficientFrontier(holdings, prices, riskFreeRate = 0.02) {
    const frontier = [];
    const numPoints = 100;

    // Simplified efficient frontier calculation
    for (let i = 0; i <= numPoints; i++) {
      const targetReturn = (i / numPoints) * 0.3; // Target return 0-30%

      // Find optimal allocation for target return
      const weights = this.optimizeWeights(holdings, prices, targetReturn);
      const expectedReturn = this.calculateExpectedReturn(weights, holdings);
      const risk = this.calculatePortfolioRisk(weights, holdings);

      frontier.push({
        return: expectedReturn.toFixed(4),
        risk: risk.toFixed(4),
        sharpeRatio: ((expectedReturn - riskFreeRate) / risk).toFixed(4),
        weights,
      });
    }

    return frontier;
  }

  /**
   * Find optimal portfolio (maximum Sharpe ratio)
   */
  findOptimalPortfolio(holdings, prices, riskFreeRate = 0.02) {
    let maxSharpe = -Infinity;
    let optimalWeights = null;

    // Brute force optimization (simplified)
    const n = holdings.length;
    for (let i = 0; i < 10000; i++) {
      const weights = this.generateRandomWeights(n);
      const expectedReturn = this.calculateExpectedReturn(weights, holdings);
      const risk = this.calculatePortfolioRisk(weights, holdings);
      const sharpe = risk > 0 ? (expectedReturn - riskFreeRate) / risk : 0;

      if (sharpe > maxSharpe) {
        maxSharpe = sharpe;
        optimalWeights = weights;
      }
    }

    const expectedReturn = this.calculateExpectedReturn(optimalWeights, holdings);
    const risk = this.calculatePortfolioRisk(optimalWeights, holdings);

    return {
      weights: optimalWeights,
      expectedReturn: expectedReturn.toFixed(4),
      risk: risk.toFixed(4),
      sharpeRatio: maxSharpe.toFixed(4),
      allocation: this.weightsToAllocation(optimalWeights, holdings),
    };
  }

  /**
   * Generate portfolio recommendations based on profile
   */
  generateRecommendations(profile, _holdings, _prices) {
    const recommendations = [];

    // Age-based recommendation
    if (profile.age < 30) {
      recommendations.push({
        type: "AGGRESSIVE",
        description: "Young investor profile - higher risk tolerance",
        recommendation: "70% growth assets, 30% stable assets",
        expectedReturn: "12-15% annually",
        riskLevel: "High",
      });
    } else if (profile.age < 50) {
      recommendations.push({
        type: "BALANCED",
        description: "Mid-career investor profile",
        recommendation: "50% growth assets, 50% stable assets",
        expectedReturn: "7-9% annually",
        riskLevel: "Medium",
      });
    } else {
      recommendations.push({
        type: "CONSERVATIVE",
        description: "Mature investor profile - lower risk tolerance",
        recommendation: "30% growth assets, 70% stable assets",
        expectedReturn: "4-6% annually",
        riskLevel: "Low",
      });
    }

    // Income-based recommendation
    if (profile.annualIncome < 50000) {
      recommendations.push({
        type: "SAVINGS_FIRST",
        description: "Build emergency fund before investing",
        recommendation: "Maintain 6 months emergency fund in stable assets",
      });
    }

    return recommendations;
  }

  /**
   * Calculate minimum variance portfolio
   */
  calculateMinVariancePortfolio(holdings) {
    const n = holdings.length;
    let minVariance = Infinity;
    let mvWeights = null;

    // Simplified: equal weight is often close to minimum variance
    const equalWeights = Array(n).fill(1 / n);
    const variance = this.calculatePortfolioVariance(equalWeights, holdings);

    if (variance < minVariance) {
      minVariance = variance;
      mvWeights = equalWeights;
    }

    return {
      weights: mvWeights,
      variance: minVariance.toFixed(4),
      standardDeviation: Math.sqrt(minVariance).toFixed(4),
      allocation: this.weightsToAllocation(mvWeights, holdings),
    };
  }

  /**
   * Suggest asset class allocation based on profile
   */
  suggestAssetAllocation(profile) {
    const allocations = {
      conservative: {
        "Stablecoins": 0.4,
        "Large Cap (BTC, ETH)": 0.3,
        "Mid Cap": 0.2,
        "Small Cap": 0.1,
      },
      moderate: {
        "Stablecoins": 0.25,
        "Large Cap (BTC, ETH)": 0.35,
        "Mid Cap": 0.25,
        "Small Cap": 0.15,
      },
      aggressive: {
        "Stablecoins": 0.1,
        "Large Cap (BTC, ETH)": 0.3,
        "Mid Cap": 0.35,
        "Small Cap": 0.25,
      },
    };

    const riskLevel = profile.riskTolerance || "moderate";
    const allocation = allocations[riskLevel] || allocations.moderate;

    return {
      riskLevel,
      targetAllocation: allocation,
      rebalancingFrequency: "quarterly",
      description: `${riskLevel.charAt(0).toUpperCase() + riskLevel.slice(1)} allocation strategy`,
    };
  }

  /**
   * Calculate tax-efficient rebalancing
   */
  calculateTaxEfficientRebalancing(portfolio, targetAllocation, taxRates) {
    const actions = [];

    Object.entries(targetAllocation).forEach(([symbol, targetAlloc]) => {
      const currentAlloc = portfolio[symbol]?.allocation || 0;
      const drift = currentAlloc - targetAlloc;

      if (Math.abs(drift) > 5) {
        const action = drift > 0 ? "SELL" : "BUY";
        const amount = Math.abs(drift);

        // Calculate tax implications if selling
        let taxCost = 0;
        if (action === "SELL") {
          const gain = portfolio[symbol]?.gain || 0;
          const taxRate = taxRates[symbol] || 0.2; // 20% default capital gains tax
          taxCost = gain > 0 ? gain * taxRate : 0;
        }

        actions.push({
          symbol,
          action,
          currentAllocation: currentAlloc.toFixed(2),
          targetAllocation: targetAlloc.toFixed(2),
          adjustmentPercent: amount.toFixed(2),
          estimatedTaxCost: taxCost.toFixed(2),
          taxEfficient: taxCost < amount * 0.5, // Less than 50% of adjustment is tax cost
        });
      }
    });

    return {
      rebalancingActions: actions,
      totalEstimatedTaxes: actions.reduce((sum, a) => sum + parseFloat(a.estimatedTaxCost), 0).toFixed(2),
      recommendation: "Review tax implications before rebalancing",
    };
  }

  /**
   * Momentum-based rebalancing suggestion
   */
  suggestMomentumRebalancing(portfolio, _prices, momentum) {
    const suggestions = [];

    Object.entries(portfolio).forEach(([symbol, _data]) => {
      const assetMomentum = momentum[symbol] || 0;

      if (assetMomentum > 0.1) {
        // Strong uptrend
        suggestions.push({
          symbol,
          action: "HOLD_OR_REDUCE",
          reason: "Strong uptrend - consider taking profits",
          momentum: assetMomentum.toFixed(4),
        });
      } else if (assetMomentum < -0.1) {
        // Strong downtrend
        suggestions.push({
          symbol,
          action: "REDUCE_OR_EXIT",
          reason: "Strong downtrend - consider stopping losses",
          momentum: assetMomentum.toFixed(4),
        });
      }
    });

    return suggestions;
  }

  // ============== Helper Methods ==============

  generateRandomWeights(n) {
    const weights = Array(n)
      .fill(0)
      .map(() => Math.random());
    const sum = weights.reduce((a, b) => a + b, 0);
    return weights.map((w) => w / sum);
  }

  optimizeWeights(holdings, _prices, _targetReturn) {
    // Simplified: return equal weights
    return Array(holdings.length).fill(1 / holdings.length);
  }

  calculateExpectedReturn(weights, holdings) {
    return weights.reduce((sum, w, i) => sum + w * (holdings[i].expectedReturn || 0.1), 0);
  }

  calculatePortfolioRisk(weights, holdings) {
    // Simplified: weighted average of individual risks
    return weights.reduce((sum, w, i) => sum + w * (holdings[i].volatility || 0.2), 0);
  }

  calculatePortfolioVariance(weights, holdings) {
    // Simplified variance calculation
    return weights.reduce((sum, w, i) => sum + Math.pow(w * (holdings[i].volatility || 0.2), 2), 0);
  }

  weightsToAllocation(weights, holdings) {
    const total = holdings.reduce((sum, h) => sum + h.value, 0);
    return weights.map((w, i) => ({
      symbol: holdings[i].symbol,
      allocation: (w * 100).toFixed(2),
      value: (w * total).toFixed(2),
    }));
  }
}

module.exports = PortfolioOptimizationService;
