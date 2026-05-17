/**
 * 计分引擎：原始分计算、百分位转换、一致性检测、类型判定、企业匹配
 */

// ========== 原始分计算 ==========
function calculateRawScores(mostLikeAnswers, leastLikeAnswers) {
  // mostLikeAnswers: { groupId: "A"|"B"|"C" } for Q1-Q98
  // leastLikeAnswers: { groupId: "A"|"B"|"C" } for Q1-Q98

  const dimScores = {};
  const dimNames = Object.keys(DIMENSIONS);
  dimNames.forEach(d => { dimScores[d] = 0; });

  // 跟踪每个维度从"最符合"和"最不符合"分别获得的分数
  const dimMostLikeHits = {};
  const dimLeastLikeHits = {};
  dimNames.forEach(d => { dimMostLikeHits[d] = 0; dimLeastLikeHits[d] = 0; });

  for (const q of QUESTION_BANK) {
    const mostKey = mostLikeAnswers[q.id];   // "A"|"B"|"C"
    const leastKey = leastLikeAnswers[q.id]; // "A"|"B"|"C"

    const optMap = { A: 0, B: 1, C: 2 };
    const mostIdx = optMap[mostKey];
    const leastIdx = optMap[leastKey];

    if (mostIdx !== undefined) {
      const dims = q.options[mostIdx].dims;
      const weight = 2 / dims.length; // 分配到每个关联维度
      dims.forEach(d => {
        dimScores[d] = (dimScores[d] || 0) + weight;
        dimMostLikeHits[d] = (dimMostLikeHits[d] || 0) + 1;
      });
    }

    if (leastIdx !== undefined) {
      const dims = q.options[leastIdx].dims;
      const weight = -1 / dims.length;
      dims.forEach(d => {
        dimScores[d] = (dimScores[d] || 0) + weight;
        dimLeastLikeHits[d] = (dimLeastLikeHits[d] || 0) + 1;
      });
    }
  }

  return { dimScores, dimMostLikeHits, dimLeastLikeHits };
}

// ========== 百分位转换 ==========
function toPercentile(rawScores) {
  // 使用 sigmoid 归一化到 1-100
  // rawScores 的理论范围取决于每题权重，通常在 -10 到 +20 之间
  const result = {};
  for (const [dim, score] of Object.entries(rawScores)) {
    // 使用改进的 sigmoid: percentile = 100 / (1 + e^(-k*(x - mid)))
    // k 控制陡峭度，mid 控制中点
    const k = 0.35;
    const mid = 5;
    const percentile = Math.round(100 / (1 + Math.exp(-k * (score - mid))));
    result[dim] = Math.max(1, Math.min(100, percentile));
  }
  return result;
}

// ========== 五大方面聚合 ==========
function aggregateAspects(percentiles) {
  const aspects = {};
  for (const [aspectName, aspectData] of Object.entries(ASPECTS)) {
    const dimVals = aspectData.dims.map(d => percentiles[d] || 50);
    aspects[aspectName] = Math.round(dimVals.reduce((a, b) => a + b, 0) / dimVals.length);
  }
  return aspects;
}

// ========== 一致性检测 ==========
function checkConsistency(rawData) {
  const { dimMostLikeHits, dimLeastLikeHits } = rawData;

  // 对每个维度，检查"最符合"和"最不符合"的命中模式
  let contradictionCount = 0;
  const contradictionDims = [];

  for (const dim of Object.keys(DIMENSIONS)) {
    const mostHits = dimMostLikeHits[dim] || 0;
    const leastHits = dimLeastLikeHits[dim] || 0;

    // 如果某个维度同时有较多的"最符合"和"最不符合"命中，说明存在矛盾
    if (mostHits >= 3 && leastHits >= 3) {
      contradictionCount++;
      contradictionDims.push(dim);
    }

    // 更严重的矛盾：两者都很高
    if (mostHits >= 5 && leastHits >= 5) {
      contradictionCount += 2; // 加权
    }
  }

  // 判定一致性等级
  let level, label, detail;
  if (contradictionCount <= 3) {
    level = "high";
    label = "高度一致";
    detail = "你的作答前后一致性很好，测评结果可信度高。";
  } else if (contradictionCount <= 7) {
    level = "moderate";
    label = "基本一致";
    detail = "你的作答整体一致，少数维度存在轻微波动，属于正常范围。";
  } else if (contradictionCount <= 12) {
    level = "low";
    label = "需关注";
    detail = "你的作答在多个维度上存在前后不一致，可能反映了对自己认知的不确定，或答题时不够专注。建议结合其他方式综合了解自己。";
  } else {
    level = "poor";
    label = "存在矛盾";
    detail = "你的作答存在较多前后矛盾，测评结果仅供参考。建议在心态平和时重新作答，尽量按照真实的第一反应选择。";
  }

  return {
    level, label, detail,
    contradictionCount,
    contradictionDims: contradictionDims.slice(0, 5) // 最多列出5个
  };
}

// ========== 性格类型判定 ==========
function determineType(percentiles) {
  // 基于五大方面的得分模式，映射到16种性格类型
  const ambition = getAspectAvg(percentiles, "抱负能量");
  const thinking = getAspectAvg(percentiles, "思维模式");
  const emotion = getAspectAvg(percentiles, "情绪适应");
  const social = getAspectAvg(percentiles, "人际互动");
  const execution = getAspectAvg(percentiles, "任务执行");

  const high = v => v >= 55;
  const types = [];

  // 抱负能量维度的类型特征
  if (high(ambition) && high(execution)) {
    types.push({ name: "开拓者", desc: "你是一个目标明确、行动力强的开拓者。你渴望成就，敢于竞争，精力充沛，同时善于将计划落地执行。你适合需要结果导向和突破能力的工作环境。", match: "字节跳动" });
  } else if (high(ambition) && !high(execution)) {
    types.push({ name: "梦想家", desc: "你充满想法和抱负，喜欢思考大方向和可能性，但在执行落地方面需要更多耐心和条理。你适合需要创意和宏观视野的角色。", match: "腾讯" });
  } else if (!high(ambition) && high(execution)) {
    types.push({ name: "实干家", desc: "你踏实肯干，不追求宏大叙事但能把每件事做到位。你执行力强、有责任心，是团队中可靠的基石。你适合需要稳定输出的岗位。", match: "阿里巴巴" });
  } else {
    types.push({ name: "平和者", desc: "你不追求激烈竞争和高压节奏，更享受平稳的工作状态。你心态平和、易于相处，适合节奏相对稳定的工作环境。", match: "腾讯" });
  }

  // 思维模式的补充标签
  if (high(thinking)) {
    types.push({ name: "分析师", desc: "你善于理性思考和深入分析，习惯用数据和逻辑说话。你对复杂问题有天然的钻研兴趣，适合需要深度思考的岗位。", match: "腾讯" });
  } else {
    types.push({ name: "直觉派", desc: "你更依赖直觉和实践经验做判断，不喜欢过度分析。你行动迅速、注重实用，适合需要快速反应的岗位。", match: "阿里巴巴" });
  }

  // 选择主类型和副类型
  const primaryType = types[0];
  const secondaryType = types[1];

  // 综合一句话描述
  const summary = generateSummary(ambition, thinking, emotion, social, execution);

  return {
    primary: primaryType,
    secondary: secondaryType,
    summary,
    aspectBreakdown: {
      "抱负能量": ambition,
      "思维模式": thinking,
      "情绪适应": emotion,
      "人际互动": social,
      "任务执行": execution,
    }
  };
}

function getAspectAvg(percentiles, aspectName) {
  const dims = ASPECTS[aspectName].dims;
  let sum = 0;
  dims.forEach(d => { sum += (percentiles[d] || 50); });
  return Math.round(sum / dims.length);
}

function generateSummary(ambition, thinking, emotion, social, execution) {
  const traits = [];

  if (ambition >= 60) traits.push("有强烈的成就动机");
  else if (ambition <= 40) traits.push("心态平和淡泊");

  if (thinking >= 60) traits.push("善于理性分析");
  else if (thinking <= 40) traits.push("依赖直觉和经验");

  if (emotion >= 60) traits.push("情绪稳定抗压");
  else if (emotion <= 40) traits.push("对压力较为敏感");

  if (social >= 60) traits.push("乐于与人交往");
  else if (social <= 40) traits.push("享受独立空间");

  if (execution >= 60) traits.push("执行力和责任感强");
  else if (execution <= 40) traits.push("行事灵活不拘一格");

  if (traits.length === 0) {
    return "你是一个性格特征比较均衡的人，各方面表现稳定，能够适应多种工作场景。";
  }

  return "你的核心特质是：" + traits.join("、") + "。";
}

// ========== 企业匹配度 ==========
function calculateCompanyMatch(percentiles) {
  const results = {};

  for (const [company, data] of Object.entries(COMPANY_PROFILES)) {
    const profile = data.profile;
    let totalDistance = 0;
    let totalWeight = 0;
    const matchDetails = [];
    const mismatchDetails = [];

    for (const [dim, range] of Object.entries(profile)) {
      const [idealMin, idealMax] = range;
      const userScore = percentiles[dim] || 50;
      const rangeWidth = idealMax - idealMin;

      // 维度的权重：范围越窄越重要（代表该公司的核心要求）
      const weight = Math.max(1, 100 - rangeWidth);

      let distance;
      if (userScore >= idealMin && userScore <= idealMax) {
        distance = 0; // 在理想区间内
      } else if (userScore < idealMin) {
        distance = (idealMin - userScore) / 100;
      } else {
        distance = (userScore - idealMax) / 100;
      }

      totalDistance += distance * weight;
      totalWeight += weight;

      // 匹配/不匹配详情
      if (distance === 0) {
        if (rangeWidth <= 35) { // 核心维度
          matchDetails.push({ dim, score: userScore, range });
        }
      } else if (distance > 0.15 && rangeWidth <= 35) {
        mismatchDetails.push({ dim, score: userScore, range, gap: Math.round(distance * 100) });
      }
    }

    // 加权平均距离 → 匹配百分比
    const avgDistance = totalDistance / totalWeight;
    const matchPercent = Math.round(Math.max(5, 100 - avgDistance * 250));

    results[company] = {
      matchPercent,
      notes: data.notes,
      matchDetails: matchDetails.slice(0, 5),
      mismatchDetails: mismatchDetails.slice(0, 5),
    };
  }

  // 按匹配度排序
  const sorted = Object.entries(results).sort((a, b) => b[1].matchPercent - a[1].matchPercent);

  return {
    ranked: sorted,
    details: results,
    bestMatch: sorted[0][0],
  };
}

// ========== 生成发展建议 ==========
function generateAdvice(percentiles, typeResult) {
  const advice = [];
  const aspects = aggregateAspects(percentiles);

  // 找出最低的方面（成长空间）
  const sortedAspects = Object.entries(aspects).sort((a, b) => a[1] - b[1]);
  const weakest = sortedAspects[0];
  const strongest = sortedAspects[sortedAspects.length - 1];

  // 最低方面建议
  const weakAdvice = {
    "抱负能量": "可以尝试设定一些有挑战性的短期目标，逐步培养自己的成就感和竞争意识。主动参与一些需要表达观点的场合，锻炼自己的影响力。",
    "思维模式": "多阅读不同领域的书籍和文章，培养批判性思维习惯。遇到问题时试着从多个角度分析，练习'为什么'式的深度追问。",
    "情绪适应": "学习一些情绪管理和压力应对的技巧，如正念冥想、运动减压。在面对变化时，给自己一些时间去适应，同时也主动寻找变化带来的机会。",
    "人际互动": "有意识地增加与他人的交流互动，参加团队活动和社交场合。练习倾听和共情，尝试站在他人的角度思考问题。",
    "任务执行": "培养制定计划和清单的习惯，从小事做起建立条理性。设定明确的时间节点，逐步提高自己的执行力和坚持度。",
  };

  // 最高方面肯定
  const strongPraise = {
    "抱负能量": "你强大的内驱力是你的核心竞争力。善用这份能量去感染和带动身边的人，同时注意在追求目标的过程中保持工作与生活的平衡。",
    "思维模式": "你出色的思维能力让你在面对复杂问题时游刃有余。继续发挥你的求知欲和洞察力，同时也可以尝试将思考成果更好地传达给他人。",
    "情绪适应": "你稳定的情绪状态是你应对挑战的重要资本。在团队中你可以成为稳定军心的力量，帮助身边的人度过困难时期。",
    "人际互动": "你出色的人际能力让你在任何团队中都能如鱼得水。善用这份能力去建立更有深度的关系网络，成为团队中的润滑剂和连接者。",
    "任务执行": "你强大的执行力是你把事情做成的保证。继续发挥你的条理性和责任感，同时也可以适当给自己留出灵活调整的空间。",
  };

  advice.push({
    title: "持续发挥你的优势",
    content: strongPraise[strongest[0]] || "继续保持你现有的优势特质，它们是你在职场中的核心竞争力。"
  });

  advice.push({
    title: "可以关注的成长方向",
    content: weakAdvice[weakest[0]] || "关注自己的成长空间，在有需要的方面进行针对性提升。"
  });

  // 针对最佳匹配公司的建议
  const bestCompany = calculateCompanyMatch(percentiles).bestMatch;
  const companyTips = {
    "字节跳动": "如果目标是字节，重点展现你的自驱力、拥抱变化的态度和追求极致的精神。面试中强调你如何主动推动事情发生，以及在不确定性中取得成果。",
    "腾讯": "如果目标是腾讯，重点展现你的学习能力、创新思维和数据驱动的工作方式。面试中强调你如何用理性分析解决问题，以及持续学习的习惯。",
    "阿里巴巴": "如果目标是阿里，重点展现你的拥抱变化能力、团队协作精神和强大的抗压韧性。面试中强调你如何融入团队、在高压下坚持使命。",
    "美团": "如果目标是美团，重点展现你的客户服务意识、主动找事做的积极性和团队合作精神。面试中强调你的责任心和在压力下越挫越勇的状态。",
    "拼多多": "如果目标是拼多多，重点展现你的极致抗压能力、逻辑清晰的高效执行力和产出驱动的自驱性。面试中从个人成长角度阐述对高强度工作的态度，切忌拖沓。",
    "滴滴": "如果目标是滴滴，重点展现你皮实乐观的性格、拥抱变化的适应力和用户导向的思维。面试中强调你独立思考和数据分析的能力。",
    "小红书": "如果目标是小红书，重点展现你的商业好奇心、共情力和创意创新能力。面试中强调你对互联网商业生态的热爱和从0到1的落地经验。",
    "快手": "如果目标是快手，重点展现你的深度思考能力、高压耐受力和持续学习的韧性。面试中注意展现扎实的专业功底（含学历背景），准备好被深问到底。",
    "京东": "如果目标是京东，重点展现你的担当拼搏精神、诚信守诺的价值观和数据分析能力。面试中强调你的战略思考和德才兼备的素质，注意跳槽频率。",
    "百度": "如果目标是百度，重点展现你好学进取的学习敏锐度、乐观皮实的心态和独立解决问题的能力。面试中注意言简意赅，重点讲'How'的实现过程。",
    "网易": "如果目标是网易，重点展现你对所做事情的热爱、独立思考的能力和脸皮厚不玻璃心的皮实。面试中强调你快速落地有结果的能力和创新精神。",
    "得物": "如果目标是得物，重点展现你求真务实的态度、拥抱变化的适应力和对年轻潮流的敏锐度。面试中强调你的数据化运营能力和不看重Title只看结果的务实。",
  };

  advice.push({
    title: `${bestCompany}求职建议`,
    content: companyTips[bestCompany] || "根据你的性格特点，选择与你匹配度最高的公司方向，在面试中有针对性地展现相关特质。"
  });

  return advice;
}

// ========== 主入口：完整计分流程 ==========
function runFullScoring(mostLikeAnswers, leastLikeAnswers) {
  // Step 1: 原始分
  const rawData = calculateRawScores(mostLikeAnswers, leastLikeAnswers);

  // Step 2: 百分位转换
  const percentiles = toPercentile(rawData.dimScores);

  // Step 3: 五大方面聚合
  const aspects = aggregateAspects(percentiles);

  // Step 4: 一致性检测
  const consistency = checkConsistency(rawData);

  // Step 5: 性格类型
  const typeResult = determineType(percentiles);

  // Step 6: 企业匹配
  const companyResult = calculateCompanyMatch(percentiles);

  // Step 7: 发展建议
  const advice = generateAdvice(percentiles, typeResult);

  return {
    rawData,
    percentiles,
    aspects,
    consistency,
    typeResult,
    companyResult,
    advice,
  };
}
