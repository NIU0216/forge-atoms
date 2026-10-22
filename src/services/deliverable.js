/**
 * Detect deliverable type from title/idea or explicit user choice.
 * Priority (auto): multimodal > game > image > ppt > web
 * @param {string} title
 * @param {string} idea
 * @param {string} [explicit] - 'auto' | 'web' | 'ppt' | 'game' | 'multimodal' | 'image'
 */
function detectDeliverable(title, idea, explicit) {
  const ex = String(explicit || 'auto').toLowerCase().trim();
  if (['ppt', 'web', 'game', 'multimodal', 'image'].includes(ex)) return ex;

  const text = `${title || ''} ${idea || ''}`;
  const lower = text.toLowerCase();

  const multimodal =
    /视频|\bvideo\b|短片|动画成片|影片|宣传片|宣传视频|音频|\baudio\b|配音|播客|歌曲|主题曲|BGM成片|做成片|生成音乐|制作音乐|做一首|写一首歌|录一段|拍一段/.test(
      text
    ) || /(?:生成|制作|做|拍|剪辑|剪).{0,16}(?:视频|短片|动画|影片|音频|音乐|配音|播客|歌曲)/.test(text);

  if (multimodal) return 'multimodal';

  const game =
    /小游戏|游戏|2048|贪吃蛇|\bsnake\b|俄罗斯方块|\btetris\b|方块|\barcade\b|mini[\s-]?game/.test(
      lower
    ) || /小游戏|游戏|2048|贪吃蛇|俄罗斯方块|方块/.test(text);

  if (game) return 'game';

  const image =
    /图片|海报|插画|封面图|像素画|拼贴画|\bposter\b|\billustration\b|宣传图|视觉图/.test(text) ||
    /(?:生成|做|画|设计).{0,12}(?:图|海报|插画|封面)/.test(text);

  if (image) return 'image';

  if (/ppt|pptx|幻灯片|演示文稿|课件|汇报|powerpoint/.test(lower) || /幻灯片|演示文稿|课件|汇报/.test(text)) {
    return 'ppt';
  }

  return 'web';
}

function deliverableLabel(d) {
  switch (d) {
    case 'ppt':
      return 'PPT 演示文稿';
    case 'game':
      return '小游戏';
    case 'image':
      return '像素海报 / 图片';
    case 'multimodal':
      return '视频 / 音频（需充值）';
    default:
      return '网站着陆页';
  }
}

module.exports = { detectDeliverable, deliverableLabel };
