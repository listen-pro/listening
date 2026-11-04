import fs from 'node:fs';

const dataPath = new URL('../../js/data.js', import.meta.url);
const src = fs.readFileSync(dataPath, 'utf8');
const marker = 'const SENTENCES = ';
new Function('globalThis.SENTENCES = ' + src.slice(src.indexOf(marker) + marker.length))();
const byId = new Map(globalThis.SENTENCES.map(sentence => [sentence.id, sentence]));

const patch = {
  1152: ['A: Hi, are you Mike?', 'A：嗨，你是麦克吗？'],
  1153: ['B: Yes, I\'m Mike. And you are?', 'B：是的，我是麦克。你呢？'],
  1164: ['A: How\'s she doing?', 'A：她的情况怎么样？'],
  1165: ['B: She is doing better.', 'B：她的情况好多了。'],
  1313: ['B: The shuttle hasn\'t arrived yet.', 'B：班车还没到。'],
  1315: ['B: Is this the airport shuttle?', 'B：这是机场班车吗？'],
  1316: ['A: Yes, this is the airport shuttle.', 'A：是的，这是机场班车。'],
  1359: ['B: Should we get dessert?', 'B：我们要不要点甜点？'],
  1360: ['A: OK, I\'ll have the cake.', 'A：好，我要蛋糕。']
};

for (const [id, [text, cn]] of Object.entries(patch)) {
  const sentence = byId.get(Number(id));
  sentence.text = text;
  sentence.cn = cn;
}

function add(id, role, text, cn, topic, level, type) {
  byId.set(id, {
    id,
    text: `${role}: ${text}`,
    type,
    sub: 'sentence',
    level,
    topic,
    cn: `${role === 'A' ? 'A：' : 'B：'}${cn}`,
    ipa: { uk: '', us: '' },
    pos: ''
  });
}

add(1700, 'A', 'Is that why you look so tense?', '所以你看起来这么紧张？', 'feelings', 'elementary', 'daily');
add(1701, 'A', 'The kitchen water isn\'t running.', '厨房不出水了。', 'home', 'elementary', 'daily');
add(1702, 'A', 'After class I go to the office.', '下课之后我去办公室。', 'work', 'elementary', 'daily');
add(1719, 'B', 'It\'s cold in here now.', '现在屋里有点冷了。', 'home', 'elementary', 'daily');
add(1703, 'A', 'What\'s holding the schedule up?', '进度卡在哪里了？', 'teamwork', 'intermediate', 'business');
add(1704, 'B', 'The data analysis is taking longer than we thought.', '数据分析比我们想的更久。', 'teamwork', 'intermediate', 'business');
add(1705, 'A', 'Should we explain it to the team this week?', '这周要不要跟团队说明一下？', 'teamwork', 'intermediate', 'business');
add(1706, 'B', 'Yes. I\'ll draft a short note.', '要。我来写一份简短说明。', 'teamwork', 'intermediate', 'business');
add(1707, 'A', 'Can you share what you learn when you\'re back?', '你回来后能分享一下收获吗？', 'teamwork', 'intermediate', 'business');
add(1708, 'B', 'Of course. I\'ll write it up for the team.', '当然。我会整理给团队。', 'teamwork', 'intermediate', 'business');
add(1715, 'A', 'Let\'s use the rest of this meeting to settle the next step.', '剩下的时间我们把下一步定下来。', 'teamwork', 'intermediate', 'business');
add(1716, 'B', 'Agreed. I\'ll send the notes this afternoon.', '同意。我今天下午把纪要发出去。', 'teamwork', 'intermediate', 'business');
add(1709, 'A', 'What happens if that funding is delayed?', '如果那笔资金推迟，会怎样？', 'strategy', 'advanced', 'business');
add(1710, 'B', 'We would have to narrow the scope.', '我们就得缩小范围。', 'strategy', 'advanced', 'business');
add(1711, 'A', 'Who will own that assessment?', '这份评估由谁负责？', 'strategy', 'advanced', 'business');
add(1712, 'B', 'I will, and I\'ll bring it to the next review.', '我来负责，下次评审我带来。', 'strategy', 'advanced', 'business');
add(1713, 'A', 'Can we finish it before the board meeting?', '董事会之前能做完吗？', 'strategy', 'advanced', 'business');
add(1714, 'B', 'Yes, if we start this week.', '可以，如果这周就开始。', 'strategy', 'advanced', 'business');
add(1717, 'A', 'Then we should decide before the quarter ends.', '那就在本季度结束前做决定。', 'strategy', 'advanced', 'business');
add(1718, 'B', 'I\'ll put that decision on the review agenda.', '我会把这个决定放进评审议程。', 'strategy', 'advanced', 'business');

const order = [
  1152, 1153, 1208, 1209, 1291, 1292, 1343, 1344, 1148, 1149, 1377, 1378, 1381, 1382, 1321, 1322, 1293, 1294, 1210, 1211,
  1276, 1299, 1300, 1212, 1213, 1186, 1187, 1252, 1253, 1335, 1336, 1363, 1364, 1222, 1223, 1228, 1229, 1234, 1235, 1317, 1318, 1379, 1380, 1391, 1392, 1184, 1185, 1190, 1191, 1242, 1243, 1339, 1340, 1162, 1163, 1258, 1259, 1130, 1131, 1110, 1111, 1112, 1113, 1104, 1105, 1375, 1376, 1383, 1384,
  1307, 1308, 1192, 1193, 1116, 1117, 1311, 1312, 1102, 1103, 1140, 1141, 1118, 1119, 1106, 1107, 1124, 1125, 1262, 1263, 1224, 1225, 1266, 1267, 1323, 1324, 1397, 1182, 1183, 1313, 1314, 1315, 1316, 1305, 1306,
  1240, 1241, 1218, 1219, 1176, 1177, 1341, 1342, 1128, 1129, 1359, 1360, 1287, 1288, 1120, 1121, 1274, 1275, 1232, 1233, 1297, 1298, 1309, 1310, 1254, 1255,
  1160, 1161, 1166, 1167, 1138, 1139, 1196, 1197, 1270, 1271, 1158, 1159, 1172, 1173, 1170, 1171, 1126, 1127, 1194, 1195, 1180, 1181, 1230, 1231, 1214, 1215, 1355, 1356, 1303, 1304, 1701, 1349, 1350, 1719, 1236, 1237,
  1136, 1137, 1100, 1101, 1206, 1207, 1256, 1257, 1351, 1352, 1337, 1338, 1353, 1354, 1244, 1245, 1268, 1269, 1146, 1147, 1285, 1286, 1216, 1217, 1238, 1239, 1331, 1332,
  1188, 1189, 1248, 1249, 1272, 1273, 1700, 1277, 1278, 1279, 1280, 1226, 1227, 1178, 1179, 1114, 1115, 1327, 1328, 1371, 1372, 1387, 1388, 1246, 1247, 1164, 1165, 1132, 1133,
  1367, 1368, 1168, 1169, 1154, 1155, 1174, 1175, 1150, 1151, 1385, 1386, 1373, 1374,
  1281, 1282, 1389, 1390, 1202, 1203, 1144, 1145, 1156, 1157, 1393, 1394, 1325, 1326, 1395, 1396, 1250, 1251, 1357, 1358, 1333, 1334, 1369, 1370, 1264, 1265, 1142, 1143, 1345, 1346, 1122, 1123, 1295, 1296, 1329, 1330, 1198, 1199, 1365, 1366,
  1361, 1362, 1319, 1320, 1283, 1284, 1260, 1261, 1702, 1134, 1135, 1200, 1201, 1204, 1205, 1301, 1302, 1347, 1348, 1220, 1221, 1289, 1290, 1108, 1109,
  1400, 1401, 1703, 1704, 1402, 1403, 1404, 1405, 1705, 1706, 1406, 1407, 1707, 1708, 1715, 1716,
  1500, 1501, 1502, 1503, 1504, 1505, 1709, 1710, 1506, 1507, 1711, 1712, 1713, 1714, 1717, 1718,
  ...Array.from({ length: 40 }, (_, index) => 1600 + index)
];

const seen = new Set();
for (const id of order) {
  if (!byId.has(id)) throw new Error(`missing ${id}`);
  if (seen.has(id)) throw new Error(`duplicate ${id}`);
  seen.add(id);
}
for (const id of byId.keys()) {
  if (!seen.has(id)) throw new Error(`left out ${id}`);
}

const sentences = order.map(id => byId.get(id));
const json = JSON.stringify(sentences);
const escaped = json.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
const header = src.slice(0, src.indexOf(marker));
fs.writeFileSync(dataPath, `${header}${marker}JSON.parse('${escaped}');\n`);
console.log('sentences', sentences.length);
