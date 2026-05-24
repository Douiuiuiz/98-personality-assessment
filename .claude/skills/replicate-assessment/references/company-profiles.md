# Company Profile Data Patterns

## How to Research Company Profiles

For each company, search for:
- Company culture/values (企业文化, 价值观)
- Campus recruitment preferences (校招偏好)
- Employee reviews on platforms like 牛客网, 脉脉, 小红书
- Official "人才观" or "talent philosophy" statements

## Profile Structure

Each company entry maps 30 dimensions to ideal score ranges [min, max]:

```js
"公司名": {
  notes: "一句话核心描述：偏好画像关键词。",
  profile: {
    "成功愿望": [min, max],
    "权力动机": [min, max],
    // ... all 30 dimensions
    "意志力": [min, max],
  }
}
```

## Dimension Range Patterns

| Score Range | Meaning | When to Use |
|---|---|---|
| [70, 100] | Very High — core requirement | Companies that NEED this trait |
| [60, 90] | High — important | Strong preference |
| [45, 75] | Moderate — balanced | Nice to have |
| [30, 60] | Low-Moderate — avoid extremes | Trait is acceptable but not emphasized |
| [10, 35] | Low — actively avoided | Companies that DISFAVOR this trait |

## 12 Internet Company Profiles (Reference)

| Company | Core Profile | Key High Traits | Key Low Traits |
|---|---|---|---|
| 字节跳动 | 创业者型 | 成功愿望, 求知欲, 创新的, 适应性, 抗压性, 活力 | 规范的 |
| 腾讯 | 聪明人型 | 求知欲, 理性的, 洞察的, 创新的 | — |
| 阿里巴巴 | 同心人型 | 责任感, 适应性, 寻求变化的, 抗压性, 意志力 | — |
| 美团 | 实干派型 | 责任感, 支持性, 意志力, 活力 | — |
| 拼多多 | 效率机器型 | 抗压性, 活力, 成功愿望, 意志力, 理性的 | 权力动机 |
| 滴滴 | 皮实乐观型 | 适应性, 乐观的, 情绪稳定性, 开放性 | — |
| 小红书 | 创作者型 | 求知欲, 同理心, 创新的, 开放性, 寻求变化的 | — |
| 快手 | 韧性战将型 | 抗压性, 意志力, 求知欲, 理性的, 成功愿望 | — |
| 京东 | 担当者型 | 责任感, 规范的, 意志力, 理性的, 前瞻性 | — |
| 百度 | 简单可依赖 | 求知欲, 理性的, 乐观的, 自我肯定的, 独立性 | — |
| 网易 | 热爱者型 | 求知欲, 创新的, 独立性, 意志力, 乐观的 | — |
| 得物 | 潮流先锋型 | 适应性, 创新的, 求知欲, 洞察的, 活力 | — |

## Weight Logic for Matching

The scoring engine automatically weights dimensions by importance:
```js
const rangeWidth = idealMax - idealMin;
const weight = Math.max(1, 100 - rangeWidth);
// Tighter ranges → higher weight → more impact on match score
```

This means dimensions with [70,100] (width=30, weight=70) matter MORE than
dimensions with [45,75] (width=30, weight=70) — same width, same weight.

But [10,35] (width=25, weight=75) matters MORE than [30,60] (width=30, weight=70)
because a narrower range means the company cares more precisely about that dimension.
