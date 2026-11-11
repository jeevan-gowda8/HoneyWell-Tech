import { amKit } from './comm'
import { THREE, kitScene, stage3D, face, quant, clamp, rad, TAU, silk } from './kit3d'

/* The AM trainer as two 3D boards drawn from their pictures: transmitter and superheterodyne
   receiver, each on a sloped stand. Metres. */

const SL = 0.62, HT = 0.44, A = Math.atan2(SL, HT), CY = HT / 2 + 0.006, N = [0, Math.sin(A), Math.cos(A)]
const BD = { tx: { X: -0.6, x0: 40, y0: 30, W: 1012, H: 716, pw: 1.05 }, rx: { X: 0.6, x0: 70, y0: 40, W: 958, H: 714, pw: 1.0 } }
const PANEL = '#F4F3EA', INK = '#10161E'

function tools(g, W, B) {
  const k = W / B.W, X = (x) => (x - B.x0) * k, Y = (y) => (y - B.y0) * k
  const t = (s, x, y, z = 12, al = 'center', c = INK) => { g.fillStyle = c; g.font = `bold ${Math.max(z, 11.5) * k}px Arial`; g.textAlign = al; g.fillText(s, X(x), Y(y)) }
  const line = (x1, y1, x2, y2, c = INK, lw = 1.8) => { g.strokeStyle = c; g.lineWidth = lw * k; g.beginPath(); g.moveTo(X(x1), Y(y1)); g.lineTo(X(x2), Y(y2)); g.stroke() }
  const path = (pts, lw = 1.8, close = false) => { g.strokeStyle = INK; g.lineWidth = lw * k; g.beginPath(); pts.forEach(([a, b], i) => (i ? g.lineTo(X(a), Y(b)) : g.moveTo(X(a), Y(b)))); if (close) g.closePath(); g.stroke() }
  const rect = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(X(x), Y(y), w * k, h * k) }
  const frame = (x, y, w, h, lw = 2) => { g.strokeStyle = INK; g.lineWidth = lw * k; g.strokeRect(X(x), Y(y), w * k, h * k) }
  const round = (x, y, r, c) => { g.fillStyle = c; g.beginPath(); g.arc(X(x), Y(y), r * k, 0, 7); g.fill() }
  const sec = (x, y, w, h, s, ty = 14) => { frame(x, y, w, h); if (s) t(s, x + w / 2, y + ty, 12) }
  const bands = ['#6B3A1E', '#C52A1E', '#E8761E', '#E8C53A', '#2E8B4C', '#1F62C4']
  const res = (x, y, v = false, i = 0) => { const w = 28, h = 9; if (v) { line(x, y - 22, x, y + 22, '#8A929D', 1.2); rect(x - h / 2, y - w / 2, h, w, '#7CC0DA');[0, 1, 2].forEach((q) => rect(x - h / 2, y - w / 2 + 5 + q * 7, h, 3, bands[(i + q * 2) % 6])) } else { line(x - 22, y, x + 22, y, '#8A929D', 1.2); rect(x - w / 2, y - h / 2, w, h, '#7CC0DA');[0, 1, 2].forEach((q) => rect(x - w / 2 + 5 + q * 7, y - h / 2, 3, h, bands[(i + q * 2) % 6])) } }
  const ic = (x, y, w = 22, h = 30, name = '') => { rect(x - w / 2, y - h / 2, w, h, '#17181C'); for (let i = 0; i < 4; i++) { const yy = y - h / 2 + 4 + (i * (h - 8)) / 3; rect(x - w / 2 - 3, yy - 1, 3, 2, '#B7BCC4'); rect(x + w / 2, yy - 1, 3, 2, '#B7BCC4') } if (name) t(name, x, y + 4, 8, 'center', '#E0E2E6') }
  const cap = (x, y, c = '#E8A85A', r = 6) => round(x, y, r, c)
  const trim = (x, y, c = '#C7CCD4') => { rect(x - 16, y - 16, 32, 32, c); round(x, y, 9, '#C49A32'); round(x, y, 5, '#6E5420') }
  const blk = (x, y, w, h, c) => rect(x, y, w, h, c)
  const tp = (x, y) => { round(x, y, 5, '#C9A640'); round(x, y, 2.4, '#6E5420') }
  const amp = (x, y, w = 28, h = 30) => path([[x, y - h / 2], [x, y + h / 2], [x + w, y]], 2, true)
  const gnd = (x, y) => { line(x, y, x, y + 7); line(x - 12, y + 7, x + 12, y + 7); line(x - 8, y + 11, x + 8, y + 11); line(x - 4, y + 15, x + 4, y + 15) }
  const modBox = (x, y, w = 70, h = 48) => { frame(x, y, w, h); path([[x + 8, y + h - 8], [x + 24, y + 8], [x + 24, y + h - 8], [x + 40, y + 8], [x + 40, y + h - 8]]); t('fc', x + w - 12, y + 24, 12, 'center') }
  const sine = (x, y, w = 44, h = 34) => { frame(x, y, w, h); g.strokeStyle = INK; g.lineWidth = 2 * k; g.beginPath(); for (let i = 0; i <= 30; i++) { const a = x + 5 + ((w - 10) * i) / 30, b = y + h / 2 - Math.sin((i / 30) * TAU) * (h / 2 - 6); if (i) g.lineTo(X(a), Y(b)); else g.moveTo(X(a), Y(b)) } g.stroke() }
  const cross = (x, y, s = 44) => { frame(x, y, s, s); line(x, y, x + s, y + s); line(x + s, y, x, y + s) }
  return { t, line, path, rect, frame, round, sec, res, ic, cap, trim, blk, tp, amp, gnd, modBox, sine, cross, k, X, Y }
}

function base(g, W, H, B) { g.fillStyle = PANEL; g.fillRect(0, 0, W, H); return tools(g, W, B) }

function drawTx(g, W, H) {
  const q = base(g, W, H, BD.tx), { t, line, sec, res, ic, cap, trim, blk, tp, amp, gnd, modBox, sine, rect, frame, round } = q
  sec(90, 68, 892, 35); line(165, 77, 925, 77, '#333'); line(165, 83, 925, 83, '#333'); line(165, 89, 925, 89, '#333'); t('A1', 128, 92, 13)
  ;[[87, 251, 'FUNCTION GENERATOR'], [338, 123, "COLPITT'S OSC."], [461, 185, 'BALANCED MODULATOR-1'], [646, 227, 'BALANCED MODULATOR-2'], [873, 110, '']].forEach(([x, w, s]) => sec(x, 103, w, 143, s, 12))
  ;[[86, 198, 'AUDIO PRE-AMPLIFIER'], [284, 274, 'VCO'], [558, 108, ''], [666, 84, ''], [750, 253, 'OUTPUT AMPLIFIER']].forEach(([x, w, s]) => sec(x, 246, w, 129, s, 12))
  ;[[85, 173], [258, 171], [429, 233], [662, 220], [882, 121]].forEach(([x, w]) => sec(x, 377, w, 158, ''))
  ;[[80, 181], [261, 168], [429, 233], [662, 149], [811, 198]].forEach(([x, w]) => sec(x, 536, w, 169, ''))
  t('BAND PASS', 612, 259, 11.5); t('FILTER', 612, 272, 11.5); t('CERAMIC', 708, 259, 11.5); t('FILTER', 708, 272, 11.5); t('POWER SUPPLY', 928, 234, 11.5); t('-12V', 915, 121); t('+12V', 915, 142); t('VCC', 915, 163); t('GND', 915, 184)
  blk(948, 108, 24, 48, '#E6E2D2'); frame(948, 108, 24, 48, 1); t('I²CON', 960, 169, 8); ic(933, 197, 16, 14); t('POWER', 968, 190, 8)
  ;[[110, 125], [145, 124], [245, 122]].forEach(([x, y]) => blk(x, y, 16, 16, '#1F62C4')); blk(96, 180, 24, 24, '#1F62C4'); round(108, 192, 5, '#D7DBE0')
  ic(207, 168, 18, 34); ic(286, 180, 18, 22)
  ;[[160, 174], [160, 183], [160, 192], [160, 201]].forEach(([x, y], i) => res(x, y, false, i)); [[247, 173], [256, 173], [264, 173], [300, 169], [312, 169]].forEach(([x, y], i) => res(x, y, true, i)); res(263, 207, false, 2); res(300, 207, false, 3); [[281, 141], [317, 133], [229, 222]].forEach(([x, y]) => cap(x, y))
  round(158, 228, 11, '#2B2E35'); round(158, 228, 5, '#BFC4CC')
  round(354, 132, 12, '#2B2E35'); round(354, 132, 5, '#BFC4CC'); [[389, 150], [398, 150], [406, 150]].forEach(([x, y], i) => res(x, y, true, i)); res(390, 140, false, 1); cap(429, 143); ic(440, 178, 14, 20); round(367, 183, 11, '#2B2E35'); round(367, 183, 5, '#BFC4CC'); cap(368, 220, '#E8D24A'); res(397, 219, false, 4); cap(416, 217)
  const bm = (x0, name) => { ;[[0, 145], [0, 155], [0, 164], [0, 173]].forEach(([a, y], i) => res(x0 + a, y, false, i)); ;[[39, 128]].forEach(([a, y], i) => res(x0 + a, y, false, i)); ic(x0 + 65, 170, 16, 32); ic(x0 + 40, 200, 14, 20); round(x0 + 110, 133, 11, '#2B2E35'); round(x0 + 110, 133, 5, '#BFC4CC'); round(x0 + 140, 136, 9, '#2B2E35'); [[125, 158], [140, 158]].forEach(([a, y], i) => res(x0 + a, y, true, i)); [[102, 158], [102, 170]].forEach(([a, y], i) => res(x0 + a, y, false, i + 2)); [[165, 170], [165, 180], [165, 190]].forEach(([a, y], i) => res(x0 + a, y, false, i)); cap(x0 + 172, 136); cap(x0 + 16, 208); blk(x0 + 92, 216, 13, 8, '#2E8B4C'); blk(x0 + 138, 210, 13, 8, '#C42A26'); round(x0 + 170, 207, 11, '#2B2E35'); round(x0 + 170, 207, 5, '#BFC4CC'); void name }
  bm(473, 'BM1'); bm(664, 'BM2')
  round(110, 268, 9, '#2B2E35'); [[160, 272], [160, 287], [160, 300], [160, 314], [160, 328], [160, 339]].forEach(([x, y], i) => res(x, y, false, i)); ic(210, 304, 14, 20); [[262, 286], [262, 299], [262, 313]].forEach(([x, y], i) => res(x, y, false, i)); round(107, 335, 9, '#2B2E35'); cap(249, 351, '#2B5FB5', 11); round(216, 351, 11, '#2B2E35'); blk(147, 348, 13, 8, '#C42A26')
  ;[[292, 273], [292, 285], [292, 295], [292, 307], [292, 319], [292, 331], [292, 343], [292, 355]].forEach(([x, y], i) => { res(x, y, false, i); res(x + 30, y, false, i + 2) }); ic(382, 295, 14, 20); trim(431, 311); cap(354, 277); cap(492, 268); cap(527, 261); res(480, 299, false, 2); res(480, 312, false, 3); res(520, 289, false, 4); blk(370, 330, 14, 8, '#E8D24A'); round(496, 351, 9, '#2B2E35'); res(526, 353, false, 1); res(376, 346, false, 3); res(376, 356, false, 5)
  round(556, 327, 19, '#B8975A'); round(556, 327, 11, '#D9C89A'); res(632, 360, false, 2); trim(632, 323); res(604, 279, false, 4); t('TR2', 610, 295, 8)
  round(710, 283, 14, '#D7DBE0'); round(710, 283, 6, '#6E5420'); t('CV3', 686, 298, 8); ic(700, 321, 14, 20); blk(709, 345, 17, 17, '#1F62C4'); cap(681, 344); round(733, 316, 5, '#222')
  ic(791, 288, 14, 20); ic(847, 288, 14, 20); ic(791, 330, 14, 20); ic(847, 330, 14, 20); blk(804, 330, 13, 8, '#C42A26'); trim(901, 306); round(782, 334, 9, '#2B2E35'); round(892, 352, 9, '#2B2E35'); [[846, 333], [846, 344], [846, 355]].forEach(([x, y], i) => res(x, y, false, i)); t('PW COIL', 927, 268, 8); [910, 919, 928, 937, 946].forEach((x) => round(x, 274, 3, '#C9A640')); t('2025', 969, 274, 9); t('S1', 969, 287, 9); t('94V-0', 967, 297, 8); t('SL2', 969, 307, 8)
  t('1-10KHz', 128, 408, 10, 'left'); t('SW1', 128, 428, 10, 'left'); t('0.1-1KHz', 128, 450, 10, 'left'); t('SINE OUT', 206, 396, 11, 'left'); t('RF OUT', 378, 396, 11, 'left'); t('500KHz', 303, 396, 10, 'left'); t('SW2', 303, 418, 10, 'left'); t('1600KHz', 303, 441, 10, 'left')
  sine(320, 442); t('FREQ.', 108, 534, 11); t('LEVEL', 214, 534, 11); t('FUNCTION', 161, 514, 11); t('GENERATOR', 161, 527, 11); t('FREQ.', 288, 534, 11); t('LEVEL', 392, 534, 11); t('VCO', 348, 527, 12)
  t('CARRIER IN', 447, 396, 11, 'left'); t('SIGNAL IN', 447, 446, 11, 'left'); t('OUT', 626, 417, 11); modBox(515, 413); line(467, 412, 500, 412); line(500, 412, 500, 437); line(500, 437, 515, 437); line(467, 462, 500, 462); line(500, 462, 500, 437); line(585, 437, 618, 437); t('BALANCED', 466, 512, 11); t('MODULATOR 1', 468, 526, 11); t('CARRIER NULL', 552, 532, 9.5); t('LEVEL', 634, 531, 10); tp(482, 411); tp(482, 461); tp(600, 437)
  t('IN', 685, 389, 11); t('OUT', 858, 389, 11); frame(713, 421, 126, 84); ;[735, 759, 783].forEach((x) => { frame(x - 5, 455, 10, 18, 1.6); line(x - 9, 441, x - 9, 480); line(x + 9, 441, x + 9, 480) }); line(713, 464, 730, 464); line(792, 464, 838, 464); line(742, 480, 742, 493); line(765, 480, 765, 493); t('CERAMIC FILTER', 770, 527, 12)
  t('OFF', 909, 397, 10); t('8F1', 909, 411, 10); t('ON', 910, 425, 10); t('1 2 3 4', 948, 442, 11); t('SWITCH', 942, 495, 11); t('FAULTS', 942, 507, 11); rect(933, 403, 49, 28, '#D42B24')
  t('CN1', 90, 561, 12); amp(134, 584); line(162, 584, 186, 584); tp(190, 583); t('OUT', 223, 566, 11); t('MIC', 113, 633, 11); t('INPUT', 113, 646, 11); gnd(101, 678); t('AUDIO PRE', 156, 689, 11); t('AMPLIFIER', 156, 701, 11); t('LEVEL', 214, 701, 11)
  frame(276, 569, 56, 78); frame(299, 589, 12, 36, 1.6); t("COLPITT'S", 304, 682, 11); t('OSCILLATOR', 304, 696, 11); t('OUTPUT', 393, 560, 11); t('LEVEL', 390, 701, 11)
  t('CARRIER IN', 450, 554, 11, 'left'); t('SIGNAL IN', 450, 604, 11, 'left'); t('MOD OUT', 636, 574, 11); modBox(515, 570); line(469, 570, 500, 570); line(500, 570, 500, 594); line(500, 594, 515, 594); line(469, 620, 500, 620); line(500, 620, 500, 594); line(585, 594, 620, 594); t('BALANCED', 466, 682, 11); t('MODULATOR 2', 468, 696, 11); t('CARRIER NULL', 552, 701, 9.5); t('LEVEL', 637, 701, 10); tp(485, 569); tp(485, 619); tp(605, 594)
  t('IN', 685, 551, 11); t('OUT', 787, 551, 11); frame(716, 588, 44, 60); g.strokeStyle = INK; g.lineWidth = 2 * q.k; g.beginPath(); g.moveTo(q.X(722), q.Y(640)); g.bezierCurveTo(q.X(732), q.Y(640), q.X(732), q.Y(602), q.X(738), q.Y(602)); g.bezierCurveTo(q.X(744), q.Y(602), q.X(744), q.Y(640), q.X(754), q.Y(640)); g.stroke(); t('fc', 738, 597, 10); t('BAND PASS FILTER', 736, 687, 11); tp(685, 600); tp(787, 600)
  t('IN', 847, 543, 11); amp(871, 584); line(899, 584, 912, 584); t('LEVEL', 857, 691, 11); t('OUTPUT', 938, 680, 11); t('AMPLIFIER', 938, 693, 11); t('ANT', 1006, 592, 8); line(980, 528, 980, 582); q.path([[968, 526], [992, 526], [980, 545]], 1.8, true); t('ANTENNA', 980, 524, 8); gnd(988, 664); [920, 932, 944].forEach((x) => { round(x, 650, 4, '#C9A640'); round(x, 662, 4, '#C9A640') })
  ;[[223, 446, ''], [393, 446, ''], [631, 465, '']].forEach(([x, y]) => tp(x, y)); ;[[223, 610], [393, 610], [635, 625], [980, 610]].forEach(([x, y]) => tp(x, y)); tp(190, 582)
  t('-AM - AMPLITUDE MODULATION TRANSMITTER KIT', 806, 717, 13); blk(497, 707, 45, 18, '#FFF'); frame(497, 707, 45, 18, 1); t('DST', 502, 714, 7, 'left'); t('SK', 502, 722, 7, 'left'); blk(526, 709, 14, 14, '#111')
  blk(60, 188, 21, 90, '#F2C81E'); g.save(); g.translate(q.X(75), q.Y(275)); g.rotate(-Math.PI / 2); g.fillStyle = '#111'; g.font = `bold ${12 * q.k}px Arial`; g.textAlign = 'left'; g.fillText('Sr. No 26100041', 0, 0); g.restore()
}
function drawRx(g, W, H) {
  const q = base(g, W, H, BD.rx), { t, line, sec, res, ic, cap, trim, blk, tp, amp, gnd, sine, cross, frame, rect, round, path } = q
  sec(105, 72, 917, 38); line(545, 80, 950, 80, '#333'); line(545, 86, 950, 86, '#333'); line(545, 92, 950, 92, '#333'); t('A1', 995, 103, 13)
  ;[[105, 139, 'POWER SUPPLY', 118], [244, 199, 'LOCAL OSCILLATOR', 14], [443, 207, 'MIXER', 12], [650, 165, 'FIRST IF AMPLIFIER', 12], [815, 207, 'SECOND IF AMPLIFIER', 12]].forEach(([x, w, s, ty]) => sec(x, 110, w, 133, s, ty))
  ;[[98, 220, 'RF AMPLIFIER'], [318, 221, 'BEAT FREQ. OSCILLATOR'], [539, 244, 'PRODUCT DETECTOR'], [783, 74, ''], [857, 165, 'AUDIO AMPLIFIER']].forEach(([x, w, s]) => sec(x, 243, w, 140, s, 13))
  ;[[88, 223], [311, 186], [497, 214], [711, 200], [911, 112]].forEach(([x, w]) => sec(x, 384, w, 163, ''))
  ;[[83, 224], [307, 129], [436, 174], [610, 200], [810, 217]].forEach(([x, w]) => sec(x, 548, w, 165, ''))
  t('I²CON', 127, 128, 8); blk(118, 132, 21, 45, '#E6E2D2'); frame(118, 132, 21, 45, 1); t('GND', 158, 133, 8); t('VCC', 158, 145, 8); t('-12V', 158, 157, 8); t('+12V', 158, 169, 8); t('POWER', 127, 214, 9); ic(192, 180, 16, 14); res(157, 193, true, 1); res(186, 161, false, 2)
  round(286, 177, 16, '#B8975A'); round(286, 177, 9, '#D9C89A'); blk(327, 133, 30, 30, '#2E8B4C'); round(342, 148, 8, '#C49A32'); [[372, 140], [372, 152], [372, 164]].forEach(([x, y], i) => res(x, y, false, i)); ic(421, 152, 14, 20); [[392, 185], [392, 199]].forEach(([x, y], i) => res(x, y, false, i + 2)); round(390, 210, 9, '#2B2E35'); blk(321, 210, 13, 8, '#2E8B4C'); res(363, 221, false, 3); cap(267, 141); cap(425, 205)
  round(453, 134, 5, '#222'); blk(479, 117, 18, 18, '#1F62C4'); trim(524, 134); [[496, 165], [507, 165]].forEach(([x, y], i) => res(x, y, true, i)); [[462, 165], [462, 177], [462, 188], [462, 200]].forEach(([x, y], i) => res(x, y, false, i)); trim(535, 198); res(576, 190, false, 3); res(582, 220, false, 4); cap(582, 130); cap(634, 132); round(612, 169, 14, '#D7DBE0'); round(612, 169, 6, '#6E5420'); round(630, 210, 9, '#2B2E35'); round(485, 220, 5, '#E8A85A')
  trim(734, 155); trim(734, 214); [[683, 165], [696, 165], [708, 165]].forEach(([x, y], i) => res(x, y, true, i)); round(791, 175, 9, '#2B2E35'); blk(792, 200, 14, 8, '#2E8B4C'); cap(773, 221)
  trim(941, 141); res(995, 134, false, 1); round(855, 158, 11, '#2B2E35'); cap(901, 133); [[886, 157], [886, 171], [886, 185]].forEach(([x, y], i) => res(x, y, false, i)); blk(825, 188, 13, 8, '#2E8B4C'); round(935, 193, 6, '#222'); blk(972, 198, 24, 22, '#2E8B4C'); t('T6', 967, 192, 8)
  rect(132, 262, 90, 16, '#EDE6CF'); frame(132, 262, 90, 16, 1); for (let i = 0; i < 9; i++) round(140 + i * 9.5, 270, 2.6, '#C9A640'); trim(203, 306); [[167, 291], [167, 304], [167, 318]].forEach(([x, y], i) => res(x, y, false, i)); blk(223, 290, 14, 8, '#C42A26'); [[234, 313], [245, 313], [255, 313]].forEach(([x, y], i) => res(x, y, true, i)); ic(284, 295, 14, 20); round(134, 338, 11, '#2B2E35'); res(195, 355, false, 3); res(230, 361, false, 4); cap(265, 351); res(108, 280, true, 2)
  t('TR7', 445, 268, 8); [[345, 293], [358, 293]].forEach(([x, y], i) => res(x, y, true, i)); round(372, 290, 6, '#222'); ic(516, 295, 14, 20); trim(421, 306); cap(389, 329); round(422, 350, 11, '#2B2E35'); [[468, 338], [468, 349]].forEach(([x, y], i) => res(x, y, false, i)); res(506, 343, false, 2)
  ic(658, 301, 16, 32, ''); cap(552, 278); [[608, 289], [608, 302], [608, 316]].forEach(([x, y], i) => res(x, y, false, i)); blk(570, 304, 18, 18, '#1F62C4'); [[696, 276], [708, 276], [720, 276], [730, 276]].forEach(([x, y], i) => res(x, y, true, i)); [[618, 346], [630, 346], [640, 346]].forEach(([x, y], i) => res(x, y, true, i)); round(583, 365, 9, '#2B2E35'); round(660, 368, 9, '#2B2E35'); blk(722, 340, 14, 8, '#C42A26'); cap(761, 348)
  g.save(); g.translate(q.X(800), q.Y(360)); g.rotate(-Math.PI / 2); g.fillStyle = INK; g.font = `bold ${12 * q.k}px Arial`; g.textAlign = 'left'; g.fillText('ENVELOPE DETECTOR', 0, 0); g.restore()
  cap(845, 265); res(824, 289, true, 2); round(843, 313, 9, '#2B2E35'); res(829, 347, false, 3); res(848, 356, false, 1)
  cap(883, 280); blk(873, 314, 14, 8, '#2E8B4C'); round(909, 313, 11, '#2B2E35'); ic(945, 296, 14, 20); [[979, 295], [979, 307], [979, 319]].forEach(([x, y], i) => res(x, y, false, i)); round(886, 349, 9, '#2B2E35'); cap(925, 355, '#2B5FB5', 11); [[964, 360], [980, 360]].forEach(([x, y], i) => res(x, y, true, i))
  t('RF IN', 171, 398, 11); t('RF OUT', 283, 398, 11); t('ANT', 111, 425, 9); t('CAB', 108, 467, 9); q.path([[118, 392], [142, 392], [130, 410]], 1.6, true); line(130, 410, 130, 424)
  frame(196, 431, 48, 50); path([[202, 475], [202, 437], [238, 456]], 2, true); line(180, 420, 196, 456); line(244, 456, 268, 420); t('RF AMPLIFIER', 203, 538, 11); t('LEVEL', 278, 532, 11); tp(166, 452); tp(278, 452); tp(131, 450)
  t('RF IN', 346, 398, 11); t('LO IN', 344, 477, 11); t('OUT', 467, 444, 11); cross(392, 441); line(360, 418, 370, 418); line(370, 418, 370, 450); line(370, 450, 392, 450); line(358, 496, 370, 496); line(370, 496, 370, 472); line(370, 472, 392, 472); line(436, 463, 454, 463); t('MIXER', 403, 538, 11); tp(344, 453); tp(344, 527); tp(467, 497)
  t('IF IN', 526, 398, 11); t('IF OUT1', 680, 398, 11); t('IF OUT2', 680, 476, 11); t('AGC2', 629, 482, 10); frame(566, 398, 66, 60); path([[576, 407], [576, 449], [610, 428]], 2, true); line(539, 418, 566, 418); line(632, 418, 671, 418); line(632, 440, 650, 440); line(650, 440, 650, 496); line(650, 496, 671, 496); line(604, 458, 604, 483); t('FIRST', 595, 528, 11); t('IF AMPLIFIER', 595, 541, 11); gnd(525, 525); tp(525, 452); tp(650, 495); tp(650, 418)
  t('IF IN1', 733, 398, 11); t('IF IN2', 733, 476, 11); t('OUT', 880, 398, 11); frame(783, 404, 64, 58); path([[792, 412], [792, 454], [826, 433]], 2, true); line(755, 421, 783, 421); line(757, 496, 762, 496); line(762, 496, 762, 446); line(762, 446, 783, 446); line(847, 433, 867, 433); t('SECOND', 811, 523, 11); t('IF AMPLIFIER', 811, 536, 11); tp(741, 453); tp(741, 527); tp(880, 453)
  t('OFF', 934, 424, 10); t('8F1', 933, 437, 10); t('ON', 934, 451, 10); rect(946, 425, 51, 30, '#D42B24'); t('1 2 3 4', 968, 477, 11); t('SWITCH', 968, 519, 11); t('FAULTS', 968, 532, 11); gnd(1004, 480)
  sine(196, 558, 47, 39); t('OUT', 270, 563, 11); t('LEVEL', 260, 694, 11); t('LOCAL OSCILLATOR', 215, 705, 10); sine(312, 565, 48, 39); t('OUT', 400, 565, 11); t('BEAT FREQ.', 348, 691, 11); t('OSCILLATOR', 348, 704, 11); t('LEVEL', 410, 701, 10); tp(270, 618); tp(400, 618)
  t('IN1', 460, 566, 11); t('IN2', 460, 640, 11); t('OUT', 582, 601, 11); cross(501, 600, 41); line(474, 585, 482, 585); line(482, 585, 482, 610); line(482, 610, 501, 610); line(474, 660, 482, 660); line(482, 660, 482, 630); line(482, 630, 501, 630); line(542, 620, 568, 620); t('PRODUCT DETECTOR', 523, 703, 11); tp(460, 618); tp(460, 690); tp(582, 652)
  t('IN', 635, 566, 11); t('OUT', 785, 566, 11); path([[668, 574], [668, 596], [690, 585]], 2, true); line(690, 574, 690, 596); line(649, 585, 668, 585); line(690, 585, 771, 585); t('JP2', 717, 655, 9); t('JP3', 759, 655, 9); t('-VE', 637, 660, 10); t('SW2', 668, 660, 10); t('+VE', 699, 660, 10); t('AGC1', 731, 692, 10); gnd(785, 680); t('ENVELOPE DETECTOR', 690, 706, 11); t('RC', 667, 620, 11); tp(635, 618); tp(785, 618)
  t('IN', 835, 561, 11); path([[884, 570], [884, 605], [915, 588]], 2, true); line(849, 588, 884, 588); line(915, 588, 962, 588); t('SPEAKER', 981, 620, 10); t('VOLUME', 901, 697, 11); t('AUDIO AMPLIFIER', 891, 708, 11); gnd(977, 680); tp(835, 621)
  t('LOCAL OSC', 143, 568, 9); t('1226', 254, 732, 10); t('St', 254, 745, 9); t('ACL-AD - AMPLITUDE DEMODULATION RECEIVER KIT', 816, 736, 13); blk(539, 724, 42, 19, '#FFF'); frame(539, 724, 42, 19, 1); blk(564, 726, 14, 14, '#111')
  blk(77, 147, 21, 80, '#F2C81E'); g.save(); g.translate(q.X(92), q.Y(224)); g.rotate(-Math.PI / 2); g.fillStyle = '#111'; g.font = `bold ${11 * q.k}px Arial`; g.textAlign = 'left'; g.fillText('Sr. No 26100040', 0, 0); g.restore()
}

const SIGNALS = {
  'dsb-fc': (v, o, t) => ({ f: (u) => (v.Ac * (1 + o.m * Math.cos(TAU * 2 * u + t)) * Math.cos(TAU * 44 * u)) / (v.Ac * 2.5), title: 'Modulated output', bars: [[-0.65, (o.m * v.Ac) / 2, 'LSB'], [0, v.Ac, 'fc'], [0.65, (o.m * v.Ac) / 2, 'USB']] }),
  'dsb-sc': (v, o, t) => ({ f: (u) => (v.Am * Math.cos(TAU * 2 * u + t) + v.bal / 100) * Math.cos(TAU * 44 * u) * 0.9, title: 'Balanced modulator output', bars: [[-0.65, v.Am / 2, 'LSB'], [0, Math.max(0.002, v.bal / 100), 'fc'], [0.65, v.Am / 2, 'USB']] }),
  'ssb-sc': (v, o, t) => ({ f: (u) => (0.85 * (o.U * Math.cos(TAU * 44 * u + t) + o.L * Math.cos(TAU * 40 * u))) / (o.U + o.L), title: 'Ceramic filter output', bars: [[-0.65, o.L, 'LSB'], [0.65, o.U, 'USB']] }),
  'envelope-detector': (v, o) => ({ f: (u) => (1 + v.m * Math.cos(TAU * 2 * u)) * 0.55 - 0.55, g: (u) => o.out[Math.floor(u * 899.99)] * 0.55 - 0.55, title: 'Envelope and detector output' }),
  superheterodyne: (v, o, t) => ({ f: (u) => o.a * 0.8 * Math.sin(TAU * 5 * u + t * 5), title: 'Audio output' }),
  agc: (v, o, t) => ({ f: (u) => (o.out / 1.8) * 0.95 * Math.sin(TAU * 4 * u + t * 3), title: 'Audio output' }),
  'fault-diagnosis': (v, o, t) => ({ f: (u) => (o.ok ? 0.82 * Math.sin(TAU * 8 * u + t * 4) * (0.7 + 0.3 * Math.cos(TAU * u * 2)) : 0.02 * Math.sin(u * 300)), title: 'Probe signal' }),
}
function drawScope(g, w, h, s) {
  g.fillStyle = '#071410'; g.fillRect(0, 0, w, h)
  const H = s?.bars ? h * 0.62 : h
  g.strokeStyle = '#123428'; g.lineWidth = 1.2; for (let i = 0; i <= 10; i++) { const x = (i * w) / 10; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke() } for (let i = 0; i <= 6; i++) { const y = (i * H) / 6; g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke() }
  if (!s) { g.fillStyle = '#FFB0A0'; g.font = 'bold 24px Arial'; g.textAlign = 'center'; g.fillText('No signal: check power and cords', w / 2, h / 2); return }
  const line = (f, c) => { g.strokeStyle = c; g.lineWidth = 2.4; g.lineJoin = 'round'; g.beginPath(); for (let i = 0; i <= w; i++) { const y = H / 2 - clamp(f(i / w), -1.05, 1.05) * (H / 2) * 0.92; if (i) g.lineTo(i, y); else g.moveTo(i, y) } g.stroke() }
  line(s.f, '#62E6C2'); if (s.g) line(s.g, '#FFC14D')
  g.font = 'bold 19px Arial'; g.textAlign = 'left'; g.fillStyle = '#E8F2F8'; g.fillText(s.title, 12, 26)
  if (s.bars) {
    g.fillStyle = '#0B1A25'; g.fillRect(0, H, w, h - H); const base = h - 32, mx = Math.max(...s.bars.map((b) => b[1]), 1)
    g.strokeStyle = '#4A5A68'; g.beginPath(); g.moveTo(16, base); g.lineTo(w - 16, base); g.stroke()
    s.bars.forEach(([p, a, l]) => { const x = w / 2 + p * (w / 2 - 34), bh = (a / mx) * (h - H - 50); g.fillStyle = '#62C6F2'; g.fillRect(x - 6, base - bh, 12, Math.max(1, bh)); g.fillStyle = '#E8F2F8'; g.font = 'bold 18px Arial'; g.textAlign = 'center'; g.fillText(l, x, base + 22) })
  }
}

const TP = [['tx', 223, 582], ['tx', 393, 414], ['tx', 631, 437], ['tx', 787, 570], ['rx', 278, 419], ['rx', 467, 465], ['rx', 684, 418], ['rx', 880, 421], ['rx', 785, 585]]
const CORDS = {
  'dsb-fc': [['tx', [222, 413], [453, 462]], ['tx', [393, 414], [453, 412]], ['tx', [631, 437], [847, 563]]],
  'dsb-sc': [['tx', [222, 413], [453, 462]], ['tx', [393, 414], [453, 412]], ['tx', [631, 437], [685, 570]]],
  'ssb-sc': [['tx', [222, 413], [453, 462]], ['tx', [393, 414], [453, 412]], ['tx', [631, 437], [685, 408]]],
  'envelope-detector': [['rx', [278, 419], [635, 585]], ['rx', [785, 585], [835, 588]]],
  superheterodyne: [['rx', [278, 419], [346, 418]], ['rx', [270, 585], [344, 496]], ['rx', [467, 465], [525, 418]], ['rx', [684, 418], [741, 421]], ['rx', [880, 421], [635, 585]], ['rx', [785, 585], [835, 588]]],
  agc: [['rx', [278, 419], [346, 418]], ['rx', [270, 585], [344, 496]], ['rx', [467, 465], [525, 418]], ['rx', [684, 418], [741, 421]], ['rx', [880, 421], [635, 585]], ['rx', [785, 585], [835, 588]]],
  'fault-diagnosis': [['tx', [222, 413], [453, 462]], ['tx', [393, 414], [453, 412]], ['tx', [631, 437], [685, 570]], ['rx', [278, 419], [346, 418]], ['rx', [467, 465], [525, 418]], ['rx', [684, 418], [741, 421]], ['rx', [880, 421], [635, 585]]],
}
const SCOPE_AT = { 'dsb-fc': ['tx', 631, 437], 'dsb-sc': ['tx', 631, 437], 'ssb-sc': ['tx', 858, 408], 'envelope-detector': ['rx', 785, 585], superheterodyne: ['rx', 785, 585], agc: ['rx', 785, 585] }
const KNOBS = {
  'dsb-fc': { fm: ['tx', 105, 503, 'kHz'], Am: ['tx', 214, 501], Ac: ['tx', 393, 499] },
  'dsb-sc': { fm: ['tx', 105, 503, 'kHz'], Am: ['tx', 214, 501], bal: ['tx', 552, 497] },
  'ssb-sc': { fm: ['tx', 105, 503, 'kHz'] },
  'envelope-detector': { rc: ['rx', 667, 595] },
  superheterodyne: {},
  agc: { V: ['rx', 267, 505] },
  'fault-diagnosis': {},
}
const vw = (X, x, y, d, sx = 0) => { const b = BD[X < 0 ? 'tx' : 'rx'], ph = (b.pw * b.H) / b.W, lx = ((x - b.x0) / b.W - 0.5) * b.pw, ly = (0.5 - (y - b.y0) / b.H) * ph, t = [X + lx + sx, CY + ly * Math.cos(A), -ly * Math.sin(A)]; return { p: [t[0], t[1] + N[1] * d, t[2] + N[2] * d], t } }

function build(host, api, exp, side) {
  const X0 = BD[side === 'rx' ? 'rx' : 'tx'].X
  const views = side === 'both'
    ? { whole: { p: [0, 2.0, 2.2], t: [0, 0.22, 0] }, tx: vw(-0.6, 546, 390, 1.72, 0.26), rx: vw(0.6, 549, 397, 1.72, 0.26) }
    : { whole: vw(X0, 546, 390, 1.72, 0.26), both: { p: [0, 2.0, 2.2], t: [0, 0.22, 0] }, lower: vw(X0, 546, 530, 1.18, 0.1), upper: vw(X0, 546, 215, 1.18, 0.1) }
  const K = kitScene(host, { background: 0xd9dde1, exposure: 0.64, env: 0.42, floor: { base: '#B98A5C', wall: 0xd9dde1 }, views, zoom: [0.2, 4], azimuth: 1.2 })
  const { add, cyl, box, alongX, alongZ, plain, hit, V, M, stdM, scene } = K
  const ctl = (k) => exp.controls.find((q) => q.k === k)
  const woodM = stdM(0xd9b37c, 0.65, 0), blueK = 0x1b5ec2
  const boards = {}
  ;['tx', 'rx'].forEach((key) => {
    const b = BD[key], ph = (b.pw * b.H) / b.W
    const shape = new THREE.Shape([[SL / 2, 0], [SL / 2, 0.006], [-SL / 2, HT + 0.006], [-SL / 2, 0]].map(([p, q]) => new THREE.Vector2(p, q)))
    const g = new THREE.ExtrudeGeometry(shape, { depth: b.pw + 0.05, bevelEnabled: false }); g.rotateY(-Math.PI / 2); g.translate(b.X + (b.pw + 0.05) / 2, 0, 0)
    const w = new THREE.Mesh(g, woodM); w.castShadow = w.receiveShadow = true; scene.add(w)
    boards[key] = K.unit({ x: b.X, z: 0, y: CY, slope: A, art: key === 'tx' ? drawTx : drawRx, x0: b.x0, y0: b.y0, W: b.W, H: b.H, pw: b.pw, artW: 2800 })
    add(box(b.pw + 0.05, ph + 0.05, 0.016), woodM, 0, 0, -0.0085, boards[key].panel)
  })
  const Y = 0xe5b52e, R = 0xd42b24, BK = 0x15161a
  const socks = (key, list, col) => list.forEach(([x, y]) => boards[key].sock(x, y, col))
  socks('tx', [[453, 412], [453, 462], [685, 408], [455, 570], [455, 620], [685, 570], [847, 563]], Y); socks('tx', [[222, 413], [393, 414], [631, 437], [858, 408], [223, 582], [393, 578], [635, 594], [787, 570]], R); socks('tx', [[101, 661], [988, 644], [152, 85]], BK); boards.tx.sock(980, 585, Y)
  socks('rx', [[112, 503], [166, 420], [346, 418], [344, 496], [525, 418], [604, 496], [741, 421], [741, 496], [460, 585], [460, 660], [731, 662], [835, 588]], Y); socks('rx', [[278, 419], [467, 465], [684, 418], [684, 496], [880, 421], [270, 585], [400, 585], [582, 620], [635, 585], [785, 585]], R); socks('rx', [[525, 496], [785, 662], [977, 662], [964, 96]], BK)
  ;[[890, 117], [890, 138], [890, 159], [890, 180]].forEach(([x, y]) => { const [a, b2] = boards.tx.P(x, y); alongZ(add(cyl(0.009, 0.004, 18), M.brass, a, b2, 0.002, boards.tx.panel)) })
  ;[[203, 121], [219, 140], [203, 158], [219, 186]].forEach(([x, y]) => { const [a, b2] = boards.rx.P(x, y); alongZ(add(cyl(0.008, 0.004, 18), M.brass, a, b2, 0.002, boards.rx.panel)) })
  const ferrite = (key, x1, x2, y) => { const b = boards[key], [a1, b1] = b.P(x1, y), [a2] = b.P(x2, y), mx = (a1 + a2) / 2, len = a2 - a1; alongX(add(cyl(0.012, len, 18), stdM(0x3a3d43, 0.5, 0.2), mx, b1, 0.03, b.panel)); alongX(add(cyl(0.02, len * 0.35, 26), stdM(0xb5703c, 0.42, 0.5), mx, b1, 0.03, b.panel)); [-0.42, 0.42].forEach((f) => alongX(add(cyl(0.028, len * 0.2, 24), M.black, mx + f * len, b1, 0.03, b.panel))); [-0.38, 0.38].forEach((f) => add(box(0.024, 0.052, 0.03), M.black, mx + f * len, b1, 0.015, b.panel)) }
  ferrite('tx', 585, 930, 52); ferrite('rx', 160, 540, 66)
  const ctlKnobs = KNOBS[exp.id] || {}, kmeshes = {}
  const kn = (key, x, y, name, r = 0.0185, col = blueK) => { const b = boards[key], [u, v] = b.P(x, y), g = new THREE.Group(); g.position.set(u, v, 0); b.panel.add(g); alongZ(add(cyl(r * 1.1, 0.012, 24), stdM(col, 0.38, 0.3), 0, 0, 0.006, g)); alongZ(add(cyl(r * 0.9, 0.012, 24), stdM(col, 0.38, 0.3), 0, 0, 0.014, g)); add(box(0.0022, r * 0.7, 0.0018), new THREE.MeshBasicMaterial({ color: 0xffffff }), 0, r * 0.45, 0.021, g); if (name) alongZ(hit(cyl(r * 1.7, 0.04, 12), 0, 0, 0.012, name, g)); return g }
  ;[['tx', 105, 503], ['tx', 214, 501], ['tx', 290, 503], ['tx', 393, 499], ['tx', 552, 497], ['tx', 634, 493], ['tx', 214, 669], ['tx', 390, 665], ['tx', 551, 660], ['tx', 636, 661], ['tx', 857, 655], ['rx', 261, 662], ['rx', 393, 665], ['rx', 267, 505], ['rx', 901, 665]].forEach(([key, x, y]) => {
    const name = Object.entries(ctlKnobs).find(([, q]) => q[0] === key && q[1] === x && q[2] === y)?.[0]
    const g = kn(key, x, y, name ? `k:${name}` : null); if (name) kmeshes[name] = g; else g.rotation.z = rad(20)
  })
  const rcKnob = kn('rx', 667, 595, ctlKnobs.rc ? 'k:rc' : null, 0.0135, 0x8e2424); if (ctlKnobs.rc) kmeshes.rc = rcKnob
  /* tuning dial */
  const [da, db] = boards.rx.P(143, 636), dial = new THREE.Group(); dial.position.set(da, db, 0); boards.rx.panel.add(dial)
  alongZ(add(cyl(0.077, 0.022, 64), M.black, 0, 0, 0.011, dial)); add(new THREE.CylinderGeometry(0.006, 0.006, 0.004, 16), M.chrome, 0, 0, 0.023, dial).rotation.x = Math.PI / 2
  add(box(0.005, 0.024, 0.0024), new THREE.MeshBasicMaterial({ color: 0xffffff }), 0, 0.058, 0.0226, dial); hit(new THREE.SphereGeometry(0.09, 16, 12), 0, 0, 0.02, 'dial', dial)
  const dialT = face(320, 80, (g, w, h, s) => { g.clearRect(0, 0, w, h); g.fillStyle = '#F7E3A0'; g.font = 'bold 46px "Courier New", monospace'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(s, w / 2, h / 2) })
  const [dx, dy] = boards.rx.P(143, 672); plain(add(new THREE.PlaneGeometry(0.1, 0.025), new THREE.MeshBasicMaterial({ map: dialT.tex, transparent: true, toneMapped: false }), dx, dy, 0.0234, boards.rx.panel))
  /* slide switches, DIP faults, power LEDs, jumpers */
  const slide = (key, x, y) => { const b = boards[key], [u, v] = b.P(x, y); add(box(0.024, 0.052, 0.005), stdM(0xe6e2d2, 0.5, 0), u, v, 0.0025, b.panel); add(box(0.016, 0.022, 0.008), M.dark, u, v + 0.012, 0.006, b.panel) }
  slide('tx', 109, 423); slide('tx', 284, 410)
  const dipRow = (key, x, y) => [0, 1, 2, 3].map((i) => { const b = boards[key], [u, v] = b.P(x + i * 13, y), m = add(box(0.008, 0.012, 0.005), stdM(0xf2f2f0, 0.5, 0), u, v + 0.006, 0.003, b.panel); hit(box(0.012, 0.03, 0.02), u, v, 0.012, `dip:${i}`, b.panel); m.userData.base = v; return m })
  const dips = [...dipRow('tx', 938, 417), ...dipRow('rx', 951, 440)]
  const power = {}
  ;[['tx', 968, 208], ['rx', 127, 195]].forEach(([key, x, y]) => { const b = boards[key], [u, v] = b.P(x, y); add(new THREE.CylinderGeometry(0.0115, 0.0115, 0.003, 18), M.chrome, u, v, 0.0015, b.panel).rotation.x = Math.PI / 2; const led = new THREE.Mesh(new THREE.SphereGeometry(0.0085, 16, 12), new THREE.MeshBasicMaterial({ color: 0xff3b30, toneMapped: false })); led.position.set(u, v, 0.005); b.panel.add(led); hit(new THREE.SphereGeometry(0.02, 8, 6), u, v, 0.012, `pwr:${key}`, b.panel); power[key] = led })
  ;[['rx', 717, 608], ['rx', 759, 608]].forEach(([key, x, y], i) => { const b = boards[key], [u, v] = b.P(x, y); add(box(0.016, 0.03, 0.01), M.black, u, v, 0.005, b.panel); if (exp.id === 'agc' && i === 1) hit(box(0.03, 0.05, 0.03), u, v, 0.012, 'jp', b.panel) })
  const [swa, swb] = boards.rx.P(668, 673); add(box(0.05, 0.016, 0.005), M.black, swa, swb, 0.0025, boards.rx.panel); add(box(0.016, 0.012, 0.007), stdM(0xe6e2d2, 0.5, 0), swa + 0.014, swb, 0.0045, boards.rx.panel)
  const [sa, sb] = boards.rx.P(982, 590); add(box(0.045, 0.045, 0.012), M.black, sa, sb, 0.006, boards.rx.panel); alongZ(add(cyl(0.015, 0.002, 26), stdM(0x63686f, 0.5, 0.3), sa, sb, 0.013, boards.rx.panel))
  const [ca, cb] = boards.tx.P(100, 584); add(box(0.04, 0.03, 0.012), M.black, ca, cb, 0.006, boards.tx.panel); alongX(add(cyl(0.008, 0.06), M.steel, ca - 0.05, cb, 0.006, boards.tx.panel))
  /* patch cords */
  const palette = [0xf5a623, 0x22a899, 0x8e5bd0, 0xe8c53a, 0xd42b24, 0x1f62c4]
  const local = (key, p, z) => V(...boards[key].P(p[0], p[1]), z)
  const cordList = CORDS[exp.id] || [], cords = cordList.map(([key, a, b], i) => {
    const d = Math.hypot(a[0] - b[0], a[1] - b[1]) * boards[key].K, up = 0.012 + d * 0.1, A2 = local(key, a, 0.012), B2 = local(key, b, 0.012), mid = A2.clone().lerp(B2, 0.5); mid.z = up; mid.y += d * 0.04
    const curve = new THREE.CatmullRomCurve3([A2, local(key, a, up * 0.7), mid, local(key, b, up * 0.7), B2])
    const m = new THREE.Mesh(new THREE.TubeGeometry(curve, 50, 0.0034, 8), stdM(palette[i % palette.length], 0.5, 0)); m.castShadow = true; boards[key].panel.add(m)
    ;[a, b].forEach((p) => { const q = local(key, p, 0.012); hit(new THREE.SphereGeometry(0.018, 8, 6), q.x, q.y, q.z, 'c', boards[key].panel) })
    return { key, m, curve }
  })
  const agcCord = exp.id === 'agc' ? (() => { const a = [731, 662], b = [604, 496], d = Math.hypot(a[0] - b[0], a[1] - b[1]) * boards.rx.K, up = 0.012 + d * 0.1, A2 = local('rx', a, 0.012), B2 = local('rx', b, 0.012), mid = A2.clone().lerp(B2, 0.5); mid.z = up; const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([A2, local('rx', a, up * 0.7), mid, local('rx', b, up * 0.7), B2]), 50, 0.0034, 8), stdM(0x2e9e43, 0.5, 0)); boards.rx.panel.add(m); return m })() : null
  const eM = new THREE.MeshBasicMaterial({ color: 0xfff1a6, toneMapped: false })
  const beads = cords.flatMap((c, i) => Array.from({ length: 3 }, (_, j) => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.0034, 8, 6), eM); m.userData = { c, u: j / 3 + i * 0.09 }; boards[c.key].panel.add(m); return m }))
  /* telescopic antennas wired to the ANT sockets */
  const antenna = (key, x, y, lean, sockAt) => {
    const b = boards[key], base = b.world(x, y, 0.012), g = new THREE.Group(); g.position.copy(base); scene.add(g)
    add(box(0.05, 0.03, 0.05), M.black, 0, 0.015, 0, g); add(new THREE.SphereGeometry(0.014, 18, 12), M.chrome, 0, 0.036, 0, g)
    const rod = new THREE.Group(); rod.position.y = 0.04; rod.rotation.z = lean; rod.rotation.x = -0.12; g.add(rod)
    const radii = [0.0068, 0.0058, 0.0049, 0.0041, 0.0034, 0.0028, 0.0023]
    radii.forEach((r, i) => { add(cyl(r, 0.1, 18), M.chrome, 0, 0.05 + i * 0.088, 0, rod); add(cyl(r + 0.0009, 0.006, 18), M.steel, 0, 0.098 + i * 0.088, 0, rod) })
    add(new THREE.SphereGeometry(0.0055, 14, 10), M.chrome, 0, 0.05 + radii.length * 0.088, 0, rod)
    const s = b.world(...sockAt, 0.012)
    K.tube([V(base.x, base.y + 0.01, base.z), V(base.x, base.y - 0.02, base.z + 0.06), V((base.x + s.x) / 2, Math.max(base.y, s.y) + 0.03, (base.z + s.z) / 2 + 0.06), s], 0x101114, 0.003)
    scene.updateMatrixWorld(true)
    return rod.localToWorld(V(0, 0.42, 0))
  }
  const txTop = antenna('tx', 1036, 600, -0.16, [980, 585]), rxTop = antenna('rx', 52, 520, 0.16, [112, 503])
  const waveM = Array.from({ length: 6 }, () => new THREE.MeshBasicMaterial({ color: 0x2f8cff, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }))
  const waves = waveM.map((m) => { const w = new THREE.Mesh(new THREE.TorusGeometry(1, 0.012, 6, 40), m); w.rotation.x = Math.PI / 2; scene.add(w); return w })
  void rxTop
  /* probe tag */
  const tag = (key) => { const b = boards[key], g = new THREE.Group(); b.panel.add(g); add(box(0.034, 0.018, 0.004), stdM(0xf0b81e, 0.45, 0), 0, 0.026, 0.008, g); const f = face(136, 72, silk('CH1', 46, '#17181C')); f.set(1); plain(add(new THREE.PlaneGeometry(0.03, 0.016), new THREE.MeshBasicMaterial({ map: f.tex, transparent: true }), 0, 0.026, 0.0104, g)); return g }
  const tags = { tx: tag('tx'), rx: tag('rx') }
  if (exp.id === 'fault-diagnosis') TP.forEach(([key, x, y], i) => { const b = boards[key], [u, v] = b.P(x, y); hit(new THREE.SphereGeometry(0.02, 8, 6), u, v, 0.016, `tp:${i + 1}`, b.panel) })

  const Q = { v: null }
  K.listen({
    grab: (d) => {
      const v = Q.v
      if (d === 'c') { api.set('c', !v.c); return }
      if (d.startsWith('pwr:')) { const k = d.slice(4) === 'tx' ? 'pTx' : 'pRx'; api.set(k, !v[k]); return }
      if (d === 'jp') { api.set('on', !v.on); return }
      if (d.startsWith('tp:')) { api.set('tp', +d.slice(3)); return }
      if (d.startsWith('dip:')) { if (exp.id !== 'fault-diagnosis') return; const i = +d.slice(4); const cur = v.f > 15 ? 0 : v.f; api.set('f', cur ^ (1 << i)); return }
      if (d === 'dial') return exp.id === 'superheterodyne' ? { d, key: 'f', val: v.f } : undefined
      if (d.startsWith('k:')) { const key = d.slice(2); return { d, key, val: v[key] } }
    },
    drag: (s, e, mv) => { const q = ctl(s.key); api.set(s.key, quant(q, s.val + (mv / 240) * (q.max - q.min))) },
    cursor: (d) => (d === 'dial' || d.startsWith('k:') ? 'grab' : 'pointer'),
  })
  const update = K.loop((v, o, t, tc) => {
    Q.v = v
    Object.entries(kmeshes).forEach(([k, g]) => { const q = ctl(k); g.rotation.z = rad(135 - clamp((v[k] - q.min) / (q.max - q.min), 0, 1) * 270) })
    const f = exp.id === 'superheterodyne' ? v.f : 1000; dial.rotation.z = -((f - 980) / 1080) * TAU * 0.8; dialT.set(`${f}`, `${f} kHz`)
    dips.forEach((m, i) => { const on = exp.id === 'fault-diagnosis' && (v.f > 15 ? 0 : v.f) & (1 << (i % 4)); m.position.y = m.userData.base + (on ? -0.006 : 0.006) })
    power.tx.material.color.set(v.pTx ? 0xff3b30 : 0x3a1412); power.rx.material.color.set(v.pRx ? 0xff3b30 : 0x3a1412)
    cords.forEach((c) => { c.m.visible = v.c }); if (agcCord) agcCord.visible = v.on
    const live = (side !== 'rx' ? v.pTx : true) && (side !== 'tx' ? v.pRx : true) && v.c
    beads.forEach((m) => { m.visible = live; if (live) m.userData.c.curve.getPoint((m.userData.u + t * 0.5) % 1, m.position) })
    const at = exp.id === 'fault-diagnosis' ? TP[v.tp - 1] : SCOPE_AT[exp.id]
    ;['tx', 'rx'].forEach((key) => { tags[key].visible = at[0] === key; if (tags[key].visible) { const [u, w] = boards[key].P(at[1], at[2]); tags[key].position.set(u, w, 0) } })
    waves.forEach((w, i) => { const u = (t * 0.35 + i / 6) % 1, on = v.pTx && v.c && side !== 'rx'; w.visible = on || (side === 'rx' && v.pRx); w.position.copy(txTop); w.position.y -= 0.12; const r = 0.03 + u * 0.24; w.scale.set(r, r, r * 0.6); w.material.opacity = (1 - u) * 0.32 })
    if (tc) drawScope(tc.getContext('2d'), tc.width, tc.height, live ? SIGNALS[exp.id](v, o, t) : null)
  })
  return K.finish(update)
}

const hintFor = (id) => ({
  'dsb-fc': 'Turn the blue FREQ. and LEVEL knobs of the function generator and the VCO LEVEL knob to change the wave. Click a patch cord socket to pull the cords, and the POWER lamp to switch the board.',
  'dsb-sc': 'Turn the function generator knobs for the audio, and CARRIER NULL to leak carrier through. Click a patch cord socket to pull the cords, and the POWER lamp to switch the board.',
  'ssb-sc': 'Turn the function generator FREQ. knob and watch the ceramic filter keep one sideband. Click a patch cord socket to pull the cords.',
  'envelope-detector': 'Turn the small red RC knob on the envelope detector and watch the output follow or miss the envelope. Modulation index is in the controls.',
  superheterodyne: 'Drag the large tuning dial through the band to find the three stations. Click a patch cord socket to pull the cords.',
  agc: 'Turn the RF AMPLIFIER LEVEL knob to change the signal, and click jumper JP3 to switch AGC. The green cord appears when AGC is on.',
  'fault-diagnosis': 'Click the red DIP switches to choose a fault, then click a stage output socket to move the CH1 probe along the chain.',
}[id])

export const am3D = amKit.map((e) => {
  const side = ['dsb-fc', 'dsb-sc', 'ssb-sc'].includes(e.id) ? 'tx' : e.id === 'fault-diagnosis' ? 'both' : 'rx'
  const labels = side === 'both' ? [['whole', 'Both boards'], ['tx', 'Transmitter'], ['rx', 'Receiver']] : [['whole', side === 'tx' ? 'Transmitter' : 'Receiver'], ['both', 'Both boards'], ['lower', 'Signal panel'], ['upper', 'Circuit board']]
  return {
    ...e,
    wide: true,
    state: () => ({ pTx: true, pRx: true, c: true }),
    read: (v, o) => { const ok = v.c && (side === 'rx' || v.pTx) && (side === 'tx' || v.pRx); return ok ? e.read(v, o) : e.read(v, o).map(([a, , u]) => [a, '–', u]) },
    sample: (v, o) => {
      if (side !== 'rx' && !v.pTx) return { error: 'The transmitter is off. Click its POWER lamp.' }
      if (side !== 'tx' && !v.pRx) return { error: 'The receiver is off. Click its POWER lamp.' }
      if (!v.c) return { error: 'The patch cords are out. Click a socket to plug them in.' }
      return e.sample(v, o)
    },
    Stage: stage3D(e, (host, api) => build(host, api, e, side), { labels, hint: hintFor(e.id), overlay: { w: 520, h: 360, alt: 'Oscilloscope trace', caption: 'Oscilloscope at CH1' } }),
  }
})
