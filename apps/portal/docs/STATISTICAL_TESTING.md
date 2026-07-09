# Statistical Testing in Kairos Benchmarks

## Why Statistical Testing Matters

When you compare two RAG configurations, you might see that Configuration A has a Recall@K of 0.85 and Configuration B has 0.82. Is Configuration A actually better, or could this difference be due to random chance?

Statistical testing answers this question. It tells you whether an observed difference is **real** or just **noise** from running on a limited set of questions.

Without statistical testing:
- You might deploy a configuration that isn't actually better
- You might discard a configuration that is actually good
- Your conclusions wouldn't be reliable enough for academic research

## How It Works in Kairos

Kairos runs benchmarks on individual questions. For each question, it records metrics like Recall@K, Precision@K, MRR, and nDCG. When comparing two configurations, we have paired data — the same questions evaluated by both configurations.

This paired structure is important because it means we can directly compare how each configuration performed on the exact same questions.

## The Two Statistical Tests

### Paired t-test (Parametric)

The paired t-test is the standard method for comparing two related groups. It works well when:

- The differences between paired measurements are **approximately normally distributed** (bell-shaped)
- You have at least a moderate number of observations (typically 20+)

**How it works:**
1. Calculate the difference for each question (Configuration A score minus Configuration B score)
2. Compute the mean and standard deviation of these differences
3. Calculate a t-statistic that measures how far the mean difference is from zero, relative to the variability
4. Convert the t-statistic to a p-value

**When to use it:** When your data looks roughly normal. The system checks this automatically.

### Wilcoxon Signed-Rank Test (Non-parametric)

The Wilcoxon test is the non-parametric alternative. It does NOT assume normality. Instead, it works with **ranks** of the differences rather than their actual values.

**How it works:**
1. Calculate the difference for each question
2. Remove any questions where the difference is exactly zero
3. Rank the absolute differences from smallest to largest
4. Assign positive ranks to positive differences and negative ranks to negative differences
5. Calculate W = sum of the smaller rank group
6. Convert W to a p-value using a normal approximation

**When to use it:** When your data is skewed, has outliers, or doesn't follow a normal distribution. This is often the safer choice for RAG metrics, which tend to be bounded between 0 and 1 and can be skewed.

## Automatic Test Selection

Kairos automatically chooses between these two tests:

1. It checks whether the differences between paired measurements are approximately normally distributed
2. If yes → uses the paired t-test (more powerful)
3. If no → uses the Wilcoxon signed-rank test (more robust)

The normality check uses skewness as a simple heuristic: if the skewness of differences is within [-2, 2], the data is treated as approximately normal.

## What is a p-value?

The p-value answers: "If there were actually no difference between the configurations, how likely is it that we would see a difference this large or larger in our data?"

- **p < 0.05**: Less than 5% chance. We call this "statistically significant."
- **p >= 0.05**: More than 5% chance. We cannot conclude the difference is real.

**Important:** A small p-value does NOT mean the difference is large or practically important. It just means it's unlikely to be due to chance. Always look at the effect size too.

**Common misconception:** "p < 0.05 means there's a 95% chance the result is real." This is wrong. The p-value is computed under the assumption that there IS no difference. It tells you how surprising your data is under that assumption.

## Confidence Intervals

A 95% confidence interval for the mean difference gives you a range of plausible values for the true difference between configurations.

- If the interval is **[0.02, 0.08]**, the true difference is likely between 2% and 8%
- If the interval includes **zero** (e.g., [-0.01, 0.05]), the difference might not be real
- A **narrower** interval means more precise estimates (usually from more questions)

Kairos computes bootstrap confidence intervals using 10,000 resamples. This method doesn't assume normality and works well for any distribution.

## Effect Size

Effect size tells you **how big** the difference is, regardless of sample size. Kairos uses two measures:

### Cohen's d (for normally distributed data)

Measures the standardized mean difference:

- **d < 0.2**: Negligible effect — the difference is tiny
- **0.2 <= d < 0.5**: Small effect — noticeable but not dramatic
- **0.5 <= d < 0.8**: Medium effect — clearly noticeable
- **d >= 0.8**: Large effect — substantial and important

### Cliff's Delta (for non-normal data)

Measures how often one configuration outperforms the other:

- **|delta| < 0.147**: Negligible
- **0.147 <= |delta| < 0.33**: Small
- **0.33 <= |delta| < 0.474**: Medium
- **|delta| >= 0.474**: Large

## Interpreting Results in Kairos

### Leaderboard

The leaderboard shows:
- **Tier (T1, T2, ...)**: Configurations in the same tier are NOT significantly different from each other
- **Significance column**: Shows the p-value for the comparison with the configuration above
- **"Not Significant"**: The observed difference could easily be due to chance

### Recommendations

When Kairos recommends a configuration, it checks whether the improvement is statistically significant:
- If significant: "Configuration X significantly outperforms Configuration Y (p=0.003, effect=medium)"
- If not significant: "This improvement was observed but is not statistically significant."

### Reports

Markdown and JSON reports include for each comparison:
- Test used (Paired t-test or Wilcoxon)
- Sample size (number of questions)
- Effect size and its magnitude
- 95% confidence interval
- p-value
- Plain-language interpretation

## Practical Guidelines

1. **Minimum sample size**: You need at least 2 questions for any comparison, but 20+ is recommended for reliable results
2. **Don't just look at p-values**: A tiny improvement can be "significant" with enough data, while a large improvement might not reach significance with too few questions
3. **Look at effect sizes**: A statistically significant result with a negligible effect size may not matter in practice
4. **Replicate results**: If possible, run the benchmark multiple times to verify consistency
5. **Use the right metric**: Different metrics answer different questions. Recall@K measures coverage, MRR measures ranking quality, nDCG measures graded relevance

## Technical Implementation

The statistical engine is implemented in pure TypeScript in `src/lib/evaluation/significance.ts`. It includes:
- Normal distribution CDF approximation
- t-distribution CDF using the incomplete beta function
- Wilcoxon signed-rank test with normal approximation
- Bootstrap resampling for confidence intervals
- Cohen's d and Cliff's delta for effect sizes
- Automatic normality checking based on skewness

All functions are deterministic (with fixed random seeds where applicable) and follow the same mathematical implementations used in established statistical libraries.
