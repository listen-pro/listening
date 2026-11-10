// ==================== TOPICS ====================
// 话题定义。js/data.js 里每条句子用 "topic" 字段指向这里的 id。
// scene：在话题面板里归到哪一组，daily（日常生活）、business（职场商务）或 it（IT 大类）。
// IT 是大类，下面每个 id 是一段独立对话，播放时不会串到别的话题。
// icon：Remix Icon 类名。hue：话题主色的色相（0-360），用于图标和选中态。
// 顺序就是页面上的显示顺序。
const TOPICS = [
  { id: 'greetings', scene: 'daily', icon: 'ri-chat-smile-2-line', hue: 268, name: { zh: '寒暄问候', en: 'Greetings' } },
  { id: 'chat', scene: 'daily', icon: 'ri-question-answer-line', hue: 215, name: { zh: '随口闲聊', en: 'Small Talk' } },
  { id: 'travel', scene: 'daily', icon: 'ri-plane-line', hue: 188, name: { zh: '出行旅途', en: 'Travel' } },
  { id: 'food', scene: 'daily', icon: 'ri-restaurant-2-line', hue: 26, name: { zh: '餐饮美食', en: 'Food & Drink' } },
  { id: 'bakery', scene: 'daily', icon: 'ri-cake-3-line', hue: 14, name: { zh: '面包店', en: 'Bakery' } },
  { id: 'home', scene: 'daily', icon: 'ri-home-4-line', hue: 152, name: { zh: '居家生活', en: 'At Home' } },
  { id: 'plans', scene: 'daily', icon: 'ri-calendar-event-line', hue: 318, name: { zh: '邀约休闲', en: 'Plans & Fun' } },
  { id: 'feelings', scene: 'daily', icon: 'ri-heart-pulse-line', hue: 350, name: { zh: '情绪健康', en: 'Feelings & Health' } },
  { id: 'dentist', scene: 'daily', icon: 'ri-stethoscope-line', hue: 192, name: { zh: '看牙医', en: 'Dentist' } },
  { id: 'shopping', scene: 'daily', icon: 'ri-shopping-bag-3-line', hue: 45, name: { zh: '购物穿搭', en: 'Shopping' } },
  { id: 'help', scene: 'daily', icon: 'ri-hand-heart-line', hue: 245, name: { zh: '沟通求助', en: 'Asking for Help' } },
  { id: 'work', scene: 'daily', icon: 'ri-book-open-line', hue: 100, name: { zh: '工作学习', en: 'Work & Study' } },
  { id: 'teamwork', scene: 'business', icon: 'ri-team-line', hue: 200, name: { zh: '项目协作', en: 'Teamwork' } },
  { id: 'strategy', scene: 'business', icon: 'ri-line-chart-line', hue: 36, name: { zh: '战略研讨', en: 'Strategy' } },
  { id: 'it', scene: 'it', icon: 'ri-terminal-box-line', hue: 172, name: { zh: '研发日常', en: 'Engineering' } },
  { id: 'onboarding', scene: 'it', icon: 'ri-user-add-line', hue: 128, name: { zh: '新人入职', en: 'Onboarding' } }
];
