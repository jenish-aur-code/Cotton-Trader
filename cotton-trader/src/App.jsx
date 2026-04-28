import { useState } from "react";

const DEG = Math.PI / 180;
const mod360 = x => ((x % 360) + 360) % 360;

function julianDay(yr, mo, dy, ut = 0) {
  if (mo <= 2) { yr--; mo += 12; }
  const A = Math.floor(yr / 100), B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25*(yr+4716)) + Math.floor(30.6001*(mo+1)) + dy + ut/24 + B - 1524.5;
}

// FIX 1: Correct Lahiri ayanamsa (IAU 1956, T from J1900)
function ayanamsa(T) { const t = T + 1; return 22.460148 + 1.396042*t + 0.000087*t*t; }

// FIX 3: IAU 1980 nutation in longitude (arcsec)
function nutationDpsi(T) {
  const T2 = T*T;
  const Om = mod360(125.04452 - 1934.136261*T + 0.0020708*T2) * DEG;
  const L  = mod360(280.4665  +   36000.7698 *T) * DEG;
  const Lp = mod360(218.3165  +  481267.8813 *T) * DEG;
  return (-17.20*Math.sin(Om) - 1.32*Math.sin(2*L)
          - 0.23*Math.sin(2*Lp) + 0.21*Math.sin(2*Om)) / 3600;
}

// FIX 1: Sun (Meeus Ch.25 + nutation)
function sunLon(T) {
  const L0 = mod360(280.46646 + 36000.76983*T + 0.0003032*T*T);
  const M  = mod360(357.52911 + 35999.05029*T - 0.0001537*T*T) * DEG;
  const e  = 0.016708634 - 0.000042037*T;
  const C  = (1.914602-0.004817*T-0.000014*T*T)*Math.sin(M)
           + (0.019993-0.000101*T)*Math.sin(2*M) + 0.000289*Math.sin(3*M);
  const Om = mod360(125.04 - 1934.136*T) * DEG;
  return mod360(L0 + C - 0.00569 - 0.00478*Math.sin(Om) + nutationDpsi(T));
}

// FIX 2: Moon (Meeus Ch.47, 60 terms, ~10 arcsec)
function moonLon(T) {
  const T2=T*T, T3=T2*T, T4=T3*T;
  const Lp=mod360(218.3165+481267.8813*T-0.001579*T2+T3/538841-T4/65194000);
  const D =mod360(297.8502+445267.1115*T-0.001630*T2+T3/545868 -T4/113065000);
  const M =mod360(357.5291+ 35999.0503*T-0.000154*T2+T3/24490000);
  const Mp=mod360(134.9634+477198.8676*T+0.008997*T2+T3/69699  -T4/14712000);
  const F =mod360( 93.2721+483202.0175*T-0.003403*T2-T3/3526000 +T4/863310000);
  const A1=mod360(119.75+131.849*T), A2=mod360(53.09+479264.290*T);
  const E=1-0.002516*T-0.0000074*T2, E2=E*E;
  const Dr=D*DEG, Mr=M*DEG, Mpr=Mp*DEG, Fr=F*DEG;
  const terms=[
    [0,0,1,0,6288774],[2,0,-1,0,1274027],[2,0,0,0,658314],[0,0,2,0,213618],
    [0,1,0,0,-185116],[0,0,0,2,-114332],[2,0,-2,0,58793],[2,-1,-1,0,57066],
    [2,0,1,0,53322],[2,-1,0,0,45758],[0,1,-1,0,-40923],[1,0,0,0,-34720],
    [0,1,1,0,-30383],[2,0,0,-2,15327],[0,0,1,2,-12528],[0,0,1,-2,10980],
    [4,0,-1,0,10675],[0,0,3,0,10034],[4,0,-2,0,8548],[2,1,-1,0,-7888],
    [2,1,0,0,-6766],[1,0,-1,0,-5163],[1,1,0,0,4987],[2,-1,1,0,4036],
    [2,0,2,0,3994],[4,0,0,0,3861],[2,0,-3,0,3665],[0,1,-2,0,-2689],
    [2,0,-1,2,-2602],[2,-1,-2,0,2390],[1,0,1,0,-2348],[2,-2,0,0,2236],
    [0,1,2,0,-2120],[0,2,0,0,-2069],[2,-2,-1,0,2048],[2,0,1,-2,-1773],
    [2,0,0,2,-1595],[4,-1,-1,0,1215],[0,0,2,2,-1110],[3,0,-1,0,-892],
    [2,1,1,0,-810],[4,-1,-2,0,759],[0,2,-1,0,-713],[2,2,-1,0,-700],
    [2,1,-2,0,691],[2,-1,0,-2,596],[4,0,1,0,549],[0,0,4,0,537],
    [4,-1,0,0,520],[1,0,-2,0,-487],[2,1,0,-2,-399],[0,0,2,-2,-381],
    [1,1,1,0,351],[3,0,-2,0,-340],[4,0,-3,0,330],[2,-1,2,0,327],
    [0,2,1,0,-323],[1,1,-1,0,299],[2,0,3,0,294],[2,0,-1,-2,0]
  ];
  let Sl=0;
  for(const [d,m,mp,f,c] of terms){
    const ef=Math.abs(m)===2?E2:Math.abs(m)===1?E:1;
    Sl+=c*ef*Math.sin(d*Dr+m*Mr+mp*Mpr+f*Fr);
  }
  Sl+=3958*Math.sin(A1*DEG)+1962*Math.sin((Lp-F)*DEG)+318*Math.sin(A2*DEG);
  return mod360(Lp+Sl/1e6);
}

// Moon latitude (for eclipse detection)
function moonLat(T) {
  const D =mod360(297.8502+445267.1115*T)*DEG;
  const M =mod360(357.5291+ 35999.0503*T)*DEG;
  const Mp=mod360(134.9634+477198.8676*T)*DEG;
  const F =mod360( 93.2721+483202.0175*T)*DEG;
  const E=1-0.002516*T, E2=E*E;
  const bt=[
    [0,0,0,1,5128122],[0,0,1,1,280602],[0,0,1,-1,277693],[2,0,0,-1,173237],
    [2,0,-1,1,55413],[2,0,-1,-1,46271],[2,0,0,1,32573],[0,0,2,1,17198],
    [2,0,1,-1,9266],[0,0,2,-1,8822],[2,-1,0,-1,8216],[2,0,-2,-1,4324],
    [2,0,1,1,4200],[2,1,0,-1,-3359],[2,-1,-1,1,2463],[2,-1,0,1,2211],
    [2,-1,-1,-1,2065],[0,1,-1,-1,-1870],[4,0,-1,-1,1828],[0,1,0,1,-1794],
    [0,0,0,3,-1749],[0,1,-1,1,-1565],[1,0,0,1,-1491],[0,1,1,1,-1475],
    [0,1,1,-1,-1410],[0,1,0,-1,-1344],[1,0,0,-1,-1335],[0,0,3,1,1107],
    [4,0,0,-1,1021],[4,0,-1,1,833]
  ];
  let Sb=0;
  for(const [d,m,mp,f,c] of bt){
    const ef=Math.abs(m)===2?E2:Math.abs(m)===1?E:1;
    Sb+=c*ef*Math.sin(d*D+m*M+mp*Mp+f*F);
  }
  return Sb/1e6;
}

// FIX 1: VSOP87 truncated series (tau = T/10, heliocentric tropical lon in radians)
function vsopL(c, tau) {
  let L=0;
  for(let i=0;i<c.length;i++){let s=0;for(const [A,B,C] of c[i])s+=A*Math.cos(B+C*tau);L+=s*Math.pow(tau,i);}
  return mod360(L/DEG);
}
function vsopR(c, tau) {
  let R=0;
  for(let i=0;i<c.length;i++){let s=0;for(const [A,B,C] of c[i])s+=A*Math.cos(B+C*tau);R+=s*Math.pow(tau,i);}
  return R;
}

// VSOP87 coefficients (source: Meeus Table 32.A - most significant terms)
const EL=[ [[1.75347046,0,0],[0.03341656,4.66925680,6283.07585],[0.00034894,4.62610938,12566.15170],[0.00003418,2.82887854,3.52311835],[0.00003497,2.74411800,5753.38488],[0.00003136,3.62767041,77713.77147],[0.00002676,4.41808345,7860.41939],[0.00002343,6.13516237,3930.20970],[0.00001324,0.74246341,11506.76977],[0.00001273,2.03716491,529.69097]],[[6283.07584999,0,0],[0.00206059,2.67823456,6283.07585],[0.00004303,2.63512650,12566.15170]],[[0.00008722,1.07209665,6283.07585]] ];
const ER=[ [[1.00013988,0,0],[0.01670700,3.09846350,6283.07585],[0.00013956,3.05524610,12566.15170],[0.00003084,5.19817640,77713.77147],[0.00001628,1.17387558,5753.38488],[0.00001576,2.84685278,7860.41939]],[[0.00103019,1.10748970,6283.07585],[0.00001721,1.06442300,12566.15170]] ];

const VL=[ [[3.17614669,0,0],[0.01353968,5.59313319,10213.28554],[0.00089892,5.30650048,20426.57109],[0.00005477,4.41630582,7860.41939],[0.00003456,2.69969635,11790.62909],[0.00002372,2.99381858,3930.20970],[0.00001664,4.25029203,1577.34354],[0.00001438,4.15750105,9153.90386],[0.00001317,5.18674789,13367.97263],[0.00001201,6.15366877,529.69097],[0.00000769,0.81606445,10404.73381]],[[10213.28554621,0,0],[0.00095708,2.46424450,10213.28554],[0.00014445,0.51120880,20426.57109],[0.00000213,1.79550400,30639.85661]],[[0.00054127,5.00109490,10213.28554],[0.00003891,5.54841500,20426.57109]] ];
const VR=[ [[0.72334821,0,0],[0.00489824,4.02151832,10213.28554],[0.00016647,6.11000700,20426.57109],[0.00001338,5.18466300,1577.34354],[0.00001267,6.17356330,6283.07585],[0.00000733,3.88509750,5577.31765],[0.00000517,4.41630582,7860.41939]],[[0.00034551,0.89199786,10213.28554]],[[0.00014346,3.14159265,0]] ];

const ML=[ [[4.40250710,0,0],[0.40989415,1.48302034,26087.90314],[0.05046294,4.47785645,52175.80628],[0.00855347,1.16520322,78263.70942],[0.00165590,4.11969163,104351.61256],[0.00034562,0.77930768,130439.51571],[0.00007583,3.71348400,156527.41885],[0.00003560,1.51202669,182615.32199],[0.00001803,4.10339853,208703.22513]],[[26087.90314157,0,0],[0.01131199,6.21874197,26087.90314],[0.00292242,3.04449600,52175.80628],[0.00075140,6.23904500,78263.70942],[0.00019336,3.06390200,104351.61256]],[[0.00053250,0,0]] ];
const MR=[ [[0.39528272,0,0],[0.07834132,6.19233722,26087.90314],[0.00795526,2.95989690,52175.80628],[0.00121282,6.01064100,78263.70942],[0.00021922,2.77820900,104351.61256],[0.00004354,5.82682600,130439.51571]],[[0.00217347,4.65617158,26087.90314],[0.00044142,1.42385548,52175.80628],[0.00010094,4.47466813,78263.70942]] ];

const ARL=[ [[6.20347711,0,0],[0.18656368,5.05037100,3340.61243],[0.01108217,5.40099836,6681.22485],[0.00091798,5.75478745,10.29494],[0.00027871,5.97049512,3337.08930],[0.00016800,0.66988450,801.82093],[0.00015720,5.19001765,3340.61243],[0.00014404,3.01336264,2810.92146],[0.00013614,5.18609948,3340.61243],[0.00009585,2.99003839,2942.46342],[0.00008642,3.90707805,3345.08459],[0.00007471,0.37059720,625.67020]],[[3340.61242670,0,0],[0.01457672,3.17627279,3340.61243],[0.00168131,4.30486700,6681.22485],[0.00020424,2.02225925,3337.08930],[0.00007581,5.15126890,10021.83728]],[[0.00058016,2.04979000,3340.61243],[0.00054905,3.14159265,0]] ];
const ARR=[ [[1.53033488,0,0],[0.14184953,3.47971284,3340.61243],[0.00660776,3.81783443,6681.22485],[0.00046179,4.15595316,10021.83728],[0.00008109,5.55115680,2810.92146],[0.00007485,1.77238916,5621.84293]],[[0.01107433,2.03250522,3340.61243],[0.00103176,5.60294980,6681.22485],[0.00012877,0,0]],[[0.00044242,0.47930000,3340.61243]] ];

const JL=[ [[0.59954691,0,0],[0.09695899,5.06191793,529.69097],[0.00573610,1.44406206,7.11355],[0.00306389,5.41734890,1059.38193],[0.00097178,4.14264723,632.78374],[0.00072903,3.64042916,522.57742],[0.00064264,3.41145165,103.09277],[0.00039806,2.29376740,419.48464],[0.00038857,1.27231755,316.39187],[0.00027441,5.68722577,536.80451],[0.00020890,1.09483850,1589.07290],[0.00016080,3.36323464,213.29910],[0.00013587,1.04578806,786.04194]],[[529.93480757,0,0],[0.00489503,4.22066689,529.69097],[0.00228840,6.02666999,7.11355],[0.00030274,4.31850200,1059.38193],[0.00010090,1.90714900,522.57742],[0.00005765,0.57799900,103.09277]],[[0.00047233,4.32148323,529.69097],[0.00016040,5.96951228,36.64856],[0.00004924,0,0]] ];
const JR=[ [[5.20887429,0,0],[0.25209327,3.49108639,529.69097],[0.00610702,3.84115365,1059.38193],[0.00282029,2.57419881,632.78374],[0.00187647,2.07590730,522.57742],[0.00086793,0.71106100,419.48464],[0.00072063,0.21509600,536.80451],[0.00065517,5.97898800,316.39187],[0.00029135,1.67759200,103.09277],[0.00022794,4.13462600,949.17561]],[[0.01271801,2.64937781,529.69097],[0.00061900,4.88048000,1059.38193],[0.00053444,3.87368400,522.57742]],[[0.00023519,4.41121700,529.69097]] ];

const SL=[ [[0.87401354,0,0],[0.11107660,3.96205090,213.29910],[0.01414151,4.58581516,7.11355],[0.00398379,0.52112032,206.18555],[0.00350769,3.30329907,426.59819],[0.00206816,0.24658372,103.09277],[0.00079271,3.84007026,220.41264],[0.00023990,4.66976972,110.20632],[0.00023142,0.67879217,419.48464],[0.00020993,4.35799839,316.39187],[0.00016406,5.52981720,519.18879],[0.00015038,6.14006470,632.78374],[0.00014523,2.40235900,14.22709]],[[213.29955268,0,0],[0.01297371,1.82834472,213.29910],[0.00564127,2.88211022,7.11355],[0.00093478,1.39528298,426.59819],[0.00107378,2.28569900,206.18555],[0.00040499,2.76958200,220.41264],[0.00019472,3.29316300,419.48464]],[[0.00116441,1.17988132,213.29910],[0.00091921,0.07425678,0],[0.00090592,5.75399700,7.11355]] ];
const SR=[ [[9.55758136,0,0],[0.52921382,2.39226220,213.29910],[0.01873680,5.23549580,206.18555],[0.01464664,1.64763042,426.59819],[0.00821891,5.93520070,316.39187],[0.00547507,5.01515510,103.09277],[0.00371684,2.27114600,220.41264],[0.00361778,3.13904640,7.11355],[0.00140443,5.70476400,632.78374],[0.00108957,3.29292300,110.20632]],[[0.06182981,0.25843552,213.29910],[0.00506578,0.71114200,206.18555],[0.00341394,5.79635700,426.59819],[0.00188491,0.47215200,220.41264],[0.00186262,3.14159265,0]],[[0.00436902,4.78671600,213.29910]] ];

function geoFromVsop(pL, pR, eL, eR, dPsi) {
  const x = pR*Math.cos(pL*DEG) - eR*Math.cos(eL*DEG);
  const y = pR*Math.sin(pL*DEG) - eR*Math.sin(eL*DEG);
  return mod360(Math.atan2(y,x)/DEG + dPsi);
}

// FIX 2: True node (Rahu) with periodic corrections
function trueRahu(T) {
  const T2=T*T, T3=T2*T;
  const Om=mod360(125.04455-1934.13626*T+0.0020708*T2+T3/450000);
  const D =mod360(297.8502 + 445267.1115*T)*DEG;
  const M =mod360(357.5291 +  35999.0503*T)*DEG;
  const Mp=mod360(134.9634 + 477198.8676*T)*DEG;
  const F =mod360( 93.2721 + 483202.0175*T)*DEG;
  return mod360(Om - 1.4979*Math.sin(2*D-2*F) - 0.1500*Math.sin(M)
                   - 0.1226*Math.sin(2*D)      + 0.1176*Math.sin(2*F)
                   - 0.0801*Math.sin(2*D+Mp-2*F));
}

// FIX 4: Nakshatra transition time (binary search, returns IST hour of next change)
function nakTransition(yr, mo, dy, istHr, ay) {
  const jd0 = julianDay(yr, mo, dy, istHr - 5.5);
  const T0  = (jd0 - 2451545) / 36525;
  const lon0 = mod360(moonLon(T0) - ay);
  const curBound = (Math.floor(lon0 / (360/27)) + 1) * (360/27);
  // Moon ~0.55°/hr → max ~24hr to next boundary; binary search 0..48hr
  let lo=0, hi=48;
  for(let i=0;i<40;i++){
    const mid=(lo+hi)/2;
    const Tm=(jd0+mid/24-2451545)/36525;
    const diff=mod360(mod360(moonLon(Tm)-ay) - curBound);
    if(diff<180) hi=mid; else lo=mid;
    if(hi-lo<0.01) break;
  }
  const hrs = Math.round(hi*10)/10;
  const dt = new Date(yr, mo-1, dy);
  dt.setMinutes(dt.getMinutes() + hrs*60);
  const nextIdx = Math.floor(curBound/(360/27)) % 27;
  return { nextNak: nextIdx, hoursFrom: hrs, atDate: dt };
}

// FIX 5: Eclipse engine (proper lunar latitude check)
function eclipseCheck(moonSid, sunSid, rahuSid, lat, phase) {
  const rahu = rahuSid, ketu = mod360(rahuSid+180);
  const mnDist = Math.min(
    Math.min(Math.abs(moonSid-rahu), 360-Math.abs(moonSid-rahu)),
    Math.min(Math.abs(moonSid-ketu), 360-Math.abs(moonSid-ketu))
  );
  const isNM = phase < 12 || phase > 348;
  const isFM = phase > 168 && phase < 192;
  if(isNM && mnDist < 18 && Math.abs(lat) < 1.54)
    return { type:"solar", total: Math.abs(lat)<0.5, certainty: Math.abs(lat)<1.0 };
  if(isFM && mnDist < 12 && Math.abs(lat) < 1.02)
    return { type:"lunar", total: Math.abs(lat)<0.5, certainty: true };
  if(isNM && mnDist < 18)
    return { type:"solar_penumbral", certainty: false };
  return null;
}

// FIX 6a: Monthly panchang bias (seasonal + astronomical context)
function panchaangBias(mo, phase, venus, sun, jupiter) {
  const biases = [];
  const vR = Math.floor(venus/30), sR = Math.floor(sun/30), jR = Math.floor(jupiter/30);
  // Kharif harvest Oct–Dec → supply ↑ → mandi pressure
  if([10,11,12].includes(mo))
    biases.push({dir:"BUY",str:2,reason:`कपास खरीफ आवक (माह ${mo}) → मंदी का मौसम`,en:`Kharif cotton arrival season (month ${mo}) → bearish bias`});
  // Pre-sowing uncertainty Apr–Jun → tight supply → tejee
  if([4,5,6].includes(mo))
    biases.push({dir:"SELL",str:2,reason:`बुवाई सीज़न (माह ${mo}) → आपूर्ति अनिश्चितता`,en:`Sowing season (month ${mo}) → supply uncertainty bullish`});
  // Venus in debilitation (Virgo) → weak for cotton
  if(vR===5)
    biases.push({dir:"BUY",str:2,reason:"शुक्र कन्या राशि (नीच) → रूई में मंदी का झुकाव",en:"Venus debilitated in Virgo → bearish cotton bias"});
  // Venus in own sign (Taurus/Libra) → strong for cotton
  if([1,6].includes(vR))
    biases.push({dir:"SELL",str:2,reason:"शुक्र स्व-राशि (वृषभ/तुला) → रूई में तेजी का झुकाव",en:"Venus in own sign Taurus/Libra → bullish cotton bias"});
  // Jupiter in Cancer (exalted) + not retro
  if(jR===3)
    biases.push({dir:"SELL",str:1,reason:"गुरु कर्क उच्च → वस्तु बाज़ार में तेजी",en:"Jupiter exalted Cancer → commodity bullish bias"});
  return biases;
}

// FIX 6b: Repetition engine — confirm signal over last 2 days
function buildRepetitionNote(signals, prevSignals1, prevSignals2) {
  const today = signals.map(s=>s.rule);
  const d1    = prevSignals1.map(s=>s.rule);
  const d2    = prevSignals2.map(s=>s.rule);
  const repeating = today.filter(r => d1.includes(r) || d2.includes(r));
  return repeating.length > 0
    ? `⚡ ${repeating.length} संकेत लगातार सक्रिय (${repeating.slice(0,2).join(", ")})`
    : null;
}

// FIX 6c: Event delay — strong signals predict price move in N days
function delayNote(signals) {
  const strong = signals.filter(s=>s.str>=4).sort((a,b)=>b.str-a.str)[0];
  if(!strong) return null;
  const dir = strong.type==="SELL" ? "तेजी" : "मंदी";
  return `${dir} का असर ${strong.dur} दिनों में (${strong.pts} टके तक) — ${strong.hindi.slice(0,40)}`;
}

// Combustion with proper orbs
const COMB_ORB = {venus:10, mercury:14, mars:17, jupiter:11, saturn:15};
function isCombust(p, s, g) { let d=Math.abs(p-s); if(d>180)d=360-d; return d<COMB_ORB[g]; }
const adiff = (a,b) => { let d=Math.abs(a-b); if(d>180)d=360-d; return d; };
const rashi  = lon => Math.floor(lon/30);
const degr   = lon => lon%30;
const nakIdx = lon => Math.floor(lon*27/360);

const RASHIS=["मेष","वृषभ","मिथुन","कर्क","सिंह","कन्या","तुला","वृश्चिक","धनु","मकर","कुम्भ","मीन"];
const NAKS=["अश्विनी","भरणी","कृत्तिका","रोहिणी","मृगशिर","आर्द्रा","पुनर्वसु","पुष्य","आश्लेषा","मघा","पू.फाल्गुनी","उ.फाल्गुनी","हस्त","चित्रा","स्वाति","विशाखा","अनुराधा","ज्येष्ठा","मूल","पू.षाढ़ा","उ.षाढ़ा","श्रवण","धनिष्ठा","शतभिषा","पू.भाद्र","उ.भाद्र","रेवती"];
const VARAS=["रवि","सोम","मंगल","बुध","गुरु","शुक्र","शनि"];

// ── Master planet computation ─────────────────────────────────────
function getPlanets(yr, mo, dy, istHr=10) {
  const jd0 = julianDay(yr, mo, dy, istHr-5.5);
  const T   = (jd0-2451545)/36525;
  const tau = T/10;
  const ay  = ayanamsa(T);
  const dPsi = nutationDpsi(T);
  const sid  = lon => mod360(lon - ay);

  const eL=vsopL(EL,tau), eR=vsopR(ER,tau);
  const ven = sid(geoFromVsop(vsopL(VL,tau),vsopR(VR,tau),eL,eR,dPsi));
  const mer = sid(geoFromVsop(vsopL(ML,tau),vsopR(MR,tau),eL,eR,dPsi));
  const mar = sid(geoFromVsop(vsopL(ARL,tau),vsopR(ARR,tau),eL,eR,dPsi));
  const jup = sid(geoFromVsop(vsopL(JL,tau),vsopR(JR,tau),eL,eR,dPsi));
  const sat = sid(geoFromVsop(vsopL(SL,tau),vsopR(SR,tau),eL,eR,dPsi));
  const sun  = sid(sunLon(T));
  const moon = sid(moonLon(T));
  const rahu = sid(trueRahu(T));

  // Retrograde via bracketed VSOP positions
  const dt=0.4/36525;
  function retroCheck(L,R) {
    const tau1=(T-dt)/10, tau2=(T+dt)/10;
    const eL1=vsopL(EL,tau1),eR1=vsopR(ER,tau1),eL2=vsopL(EL,tau2),eR2=vsopR(ER,tau2);
    const p1=sid(geoFromVsop(vsopL(L,tau1),vsopR(R,tau1),eL1,eR1,nutationDpsi(T-dt)));
    const p2=sid(geoFromVsop(vsopL(L,tau2),vsopR(R,tau2),eL2,eR2,nutationDpsi(T+dt)));
    let d=p2-p1; if(d>180)d-=360; if(d<-180)d+=360; return d<0;
  }
  const retro={venus:retroCheck(VL,VR),mercury:retroCheck(ML,MR),mars:retroCheck(ARL,ARR),jupiter:retroCheck(JL,JR),saturn:retroCheck(SL,SR)};
  const combust={venus:isCombust(ven,sun,"venus"),mercury:isCombust(mer,sun,"mercury"),mars:isCombust(mar,sun,"mars"),jupiter:isCombust(jup,sun,"jupiter"),saturn:isCombust(sat,sun,"saturn")};

  const moonLatDeg = moonLat(T);
  const phase = mod360(moon-sun);
  const eclipse = eclipseCheck(moon,sun,rahu,moonLatDeg,phase);
  const nakTrans = nakTransition(yr,mo,dy,istHr,ay);
  const biases   = panchaangBias(mo,phase,ven,sun,jup);

  return {sun,moon,venus:ven,mercury:mer,mars:mar,jupiter:jup,saturn:sat,rahu,ketu:mod360(rahu+180),
          retro,combust,phase,moonLatDeg,eclipse,nakTrans,biases,
          moonNak:nakIdx(moon),sunNak:nakIdx(sun),moNakPada:Math.floor((moon%(360/27))/((360/27)/4))+1,
          vara:Math.floor(jd0+1.5)%7, T, ay, jd:jd0};
}

// ── Rule Engine ────────────────────────────────────────────────────
function analyze(p) {
  const s=[];
  const vR=rashi(p.venus),mR=rashi(p.mars),sR=rashi(p.sun),moR=rashi(p.moon);
  const jR=rashi(p.jupiter),saR=rashi(p.saturn),raR=rashi(p.rahu),meR=rashi(p.mercury);
  const vD=degr(p.venus),mD=degr(p.mars),saD=degr(p.saturn),jD=degr(p.jupiter);
  const isNew=p.phase<12||p.phase>348, isFull=p.phase>168&&p.phase<192;
  const sell=(dur,pts,str,h,e,rule)=>s.push({type:"SELL",dur,pts,str,hindi:h,en:e,rule});
  const buy =(dur,pts,str,h,e,rule)=>s.push({type:"BUY", dur,pts,str,hindi:h,en:e,rule});

  // Eclipse signals (FIX 5)
  if(p.eclipse){
    if(p.eclipse.type==="solar"&&p.eclipse.total) sell(15,35,5,"पूर्ण सूर्यग्रहण → रूई तेजी","Total solar eclipse → bullish cotton","EC1");
    else if(p.eclipse.type==="solar") sell(10,20,4,"सूर्यग्रहण → रूई तेजी","Solar eclipse → bullish","EC2");
    else if(p.eclipse.type==="lunar") buy(10,25,4,"चन्द्रग्रहण → रूई मंदी","Lunar eclipse → bearish","EC3");
  }
  // Panchang bias (FIX 6a)
  for(const b of p.biases){
    if(b.dir==="SELL") sell(30,15,b.str,b.reason,b.en,"BIAS");
    else buy(30,15,b.str,b.reason,b.en,"BIAS");
  }

  // ── TEJEE → SELL ─────────────────────────────────
  if(p.retro.venus&&p.retro.mars&&vR===7&&mR===7) sell(11,45,5,"शुक्र+मंगल वक्री वृश्चिक → ४५ टके","Venus+Mars retro Scorpio → +45pts","LB6");
  if(p.retro.venus&&p.retro.jupiter&&vR===11&&jR===11) sell(40,100,5,"शुक्र+गुरु वक्री मीन → १०० टके","Venus+Jupiter retro Pisces → +100pts","LB7");
  if(saR===9&&mR===9&&Math.abs(adiff(p.saturn,p.venus)-150)<5) sell(30,75,5,"मकर शनि+मंगल + शुक्र १५०° → ७५ टके","Saturn+Mars Capricorn + Venus 150° → +75pts","LB16");
  if(vR===7&&mR===7&&(jR===7||saR===7)) sell(21,45,5,"वृश्चिक शुक्र+मंगल+शनि/गुरु → ४५ टके","V+Mars+Sat/Jup Scorpio → +45pts","LB19");
  if([11,8].includes(saR)&&saR===raR&&(p.retro.mars||p.combust.mars)) sell(20,60,5,"मीन/धनु शनि+राहु + वक्री मंगल → ६० टके","Saturn+Rahu Pisces/Sag + retro Mars → +60pts","R159");
  if(mR===0&&vR===0&&raR===0) sell(21,40,5,"मेष मंगल+शुक्र+राहु → तेजी","Mars+Venus+Rahu Aries → bullish","R165");
  if(p.retro.venus&&[0,7,9].includes(vR)){
    const mal=[mR,saR,raR].filter(r=>r===vR).length;
    sell(mal>=2?25:15,mal>=2?50:30,mal>=2?5:4,`शुक्र वक्री ${RASHIS[vR]}${mal>=2?" + पाप ग्रह":""} → तेजी`,`Venus retro ${RASHIS[vR]}${mal>=2?" + malefics":""}→ bullish`,"LB1");
  }
  if(p.retro.mars&&[4,7].includes(mR)) sell(14,35,4,"मंगल वक्री सिंह/वृश्चिक → तेजी","Mars retro Leo/Scorpio → bullish","LB5");
  if(p.retro.venus&&[0,4,7,9].includes(vR)&&vD>=9&&vD<=18) sell(21,50,4,"शुक्र वक्री ९-१८° → ५० टके","Venus retro 9-18° → +50pts","LB8");
  if(p.combust.mars&&p.combust.venus&&[0,3,7,9].includes(sR)) sell(11,45,4,"मंगल+शुक्र अस्त → ४५ टके","Mars+Venus combust → +45pts","LB12");
  if(mR===6&&saR===7&&vR===9&&!p.retro.venus) sell(15,40,4,"तुला मंगल + वृश्चिक शनि + मकर शुक्र → ४० टके","Mars Libra+Saturn Scorpio+Venus Cap → +40pts","LB15");
  if(p.retro.venus&&p.retro.mars&&vR===0&&mR===0) sell(8,20,4,"मेष शुक्र+मंगल वक्री → २० टके","Venus+Mars retro Aries → +20pts","WB6");
  if(jR===3&&mR===6&&(saR===11||vR===0)) sell(15,30,4,"गुरु कर्क + मंगल तुला → तेजी","Jupiter Cancer + Mars Libra → bullish","R158");
  if(sR===3&&mR===4&&vR===4) sell(15,32,4,"कर्क सूर्य + सिंह मंगल+शुक्र → ३२ टके","Sun Cancer+Mars+Venus Leo → +32pts","LB18");
  if([0,7,9].includes(sR)&&sR===vR) sell(10,22,4,"मेष/वृश्चिक/मकर सूर्य+शुक्र → २२ टके","Sun+Venus Aries/Scorpio/Cap → +22pts","LB17");
  if(p.retro.saturn&&saR===9&&saD>=7&&saD<=18) sell(15,50,4,"मकर वक्री शनि ७-१८° → ५० टके","Saturn retro Capricorn 7-18° → +50pts","LB22");
  if(p.retro.venus&&vR===1&&vD>=14&&vD<=16&&[saR,raR].includes(9)) sell(8,40,4,"वृषभ शुक्र वक्री १५° + मकर शनि/राहु → ४० टके","Venus retro 15° Taurus+Saturn/Rahu Cap → +40pts","LB11");
  if([0,7].includes(vR)&&vR===mR&&vR===raR&&vD<=19) sell((p.retro.venus||p.retro.mars)?21:14,(p.retro.venus||p.retro.mars)?40:20,(p.retro.venus||p.retro.mars)?5:3,"मेष/वृश्चिक राहु+मंगल+शुक्र → तेजी","Rahu+Mars+Venus Aries/Scorpio → bullish","LB13");
  if(p.retro.saturn&&saR===7) sell(10,20,3,"वृश्चिक वक्री शनि → तेजी","Saturn retro Scorpio → bullish","LB21");
  if(p.combust.saturn) sell(5,17,3,"शनि अस्त → १७ टके","Saturn combust → +17pts","LB9");
  if(vR===10&&vD>=11&&vD<=21) sell(11,22,3,"कुम्भ शुक्र ११-२१° → २२ टके","Venus Aquarius 11-21° → +22pts","LB20");
  if(mR===11&&mD<3) sell(5,11,3,"मंगल मीन प्रवेश → ११ टके","Mars enters Pisces → +11pts","WB5");
  if(p.sunNak===6&&p.moonNak===17) sell(3,15,3,"सूर्य पुनर्वसु + चन्द्र ज्येष्ठा → तेजी","Sun Punarvasu+Moon Jyeshtha → bullish","NB1");
  if(p.sunNak===6&&p.moonNak===18) sell(3,15,3,"सूर्य पुनर्वसु + चन्द्र मूल → तेजी","Sun Punarvasu+Moon Mool → bullish","NB2");
  if(p.sunNak===7&&p.moonNak===3) sell(3,15,3,"सूर्य पुष्य + चन्द्र रोहिणी → तेजी","Sun Pushya+Moon Rohini → bullish","NB6");
  if(sR===1&&[7,9].includes(moR)) sell(4,18,3,"वृषभ सूर्य + वृश्चिक/मकर चन्द्र → तेजी","Sun Taurus+Moon Scorpio/Cap → bullish","NB8");
  if(sR===7&&moR===7) sell(3,18,3,"वृश्चिक सूर्य+चन्द्र → तेजी","Scorpio Sun+Moon → bullish","NB9");
  if(p.retro.mercury&&p.retro.venus) sell(7,18,3,"बुध+शुक्र वक्री → तेजी","Mercury+Venus both retro → bullish","WB4");
  if(adiff(p.mars,p.venus)<10) sell(2,5,2,"मंगल-शुक्र युति → ५ टके","Mars-Venus conjunction → +5pts","DB9");
  if(adiff(p.saturn,p.venus)<10) sell(2,5,2,"शनि-शुक्र युति → ५ टके","Saturn-Venus conjunction → +5pts","DB10");
  if(adiff(p.rahu,p.venus)<10&&[7,9].includes(vR)) sell(2,3,2,"राहु-शुक्र युति → ३ टके","Rahu-Venus conjunction → +3pts","DB11");
  if(moR===7&&sR===7) sell(2,18,3,"वृश्चिक चन्द्र+सूर्य → तेजी","Scorpio Moon+Sun → bullish","DB3");
  if(isNew) sell(2,8,2,"अमावस्या → ८ टके","Near Amavasya → +8pts","WB2");
  if(!p.retro.venus&&!p.combust.venus){const d=mod360(p.venus-p.sun);if(d>10&&d<48)sell(7,12,2,"शुक्र मार्गी सूर्य से आगे → हल्की तेजी","Venus direct ahead of Sun → mild bullish","LB4");}

  // ── MANDI → BUY ──────────────────────────────────
  if(isFull&&moR===vR) buy(60,75,5,"पूर्णिमा चन्द्र+शुक्र एक राशि → मंदी","Full Moon+Venus same rashi → -75pts","LM2");
  if(!p.retro.venus&&!p.retro.jupiter&&[11,5,2].includes(vR)&&sR===vR) buy(40,100,5,"शुक्र+गुरु मार्गी मीन/कन्या/मिथुन+सूर्य → मंदी","Venus+Jupiter direct Pisces/Virgo/Gemini+Sun → -100pts","LM3");
  if([2,5].includes(raR)&&raR===vR&&meR===3) buy(30,100,5,"मिथुन/कन्या राहु+शुक्र + कर्क बुध → मंदी","Rahu+Venus Gemini/Virgo+Mercury Cancer → -100pts","LM8");
  if(saR===8&&vR===8&&jR===8&&!p.retro.saturn&&!p.retro.venus&&!p.retro.jupiter&&[2,3,10,11].includes(sR)) buy(21,45,5,"धनु शनि+शुक्र+गुरु मार्गी → मंदी","Saturn+Venus+Jupiter direct Sag → -45pts","LM24");
  if(!p.retro.venus&&[5,3,2].includes(vR)&&(p.retro.jupiter||p.retro.mercury)) buy(25,30,4,"शुक्र मार्गी कन्या/कर्क/मिथुन + वक्री गुरु/बुध → मंदी","Venus direct Virgo/Cancer/Gemini+retro Jup/Merc → -30pts","LM1");
  if(!p.retro.venus&&[2,3,5].includes(vR)&&vD>=5&&vD<=20&&jR===vR&&!p.retro.jupiter) buy(21,50,4,"शुक्र+गुरु मार्गी मिथुन/कर्क/कन्या → मंदी","Venus+Jupiter direct Gemini/Cancer/Virgo → -50pts","LM4");
  if([5,3].includes(jR)&&!p.retro.venus&&!p.retro.jupiter){const d=adiff(p.jupiter,p.venus);if(Math.abs(d-60)<5||Math.abs(d-120)<5||Math.abs(d-150)<5)buy(20,50,4,"कन्या/कर्क गुरु + शुक्र ६०/१२०/१५०° → मंदी","Jupiter Virgo/Cancer+Venus 60/120/150° → -50pts","LM5");}
  if(mR===2&&saR===2&&vR===3) buy(15,35,4,"मिथुन मंगल+शनि + कर्क शुक्र → मंदी","Mars+Saturn Gemini+Venus Cancer → -35pts","LM16");
  if(jR===3&&vR===3&&!p.retro.jupiter&&!p.retro.venus) buy(30,55,4,"कर्क गुरु+शुक्र मार्गी → मंदी","Jupiter+Venus direct Cancer → -55pts","LM17");
  if(sR===5&&vR===5&&jR===5) buy(15,32,4,"कन्या सूर्य+शुक्र+गुरु → मंदी","Sun+Venus+Jupiter Virgo → -32pts","LM19");
  if((vR===2||vR===8)&&vR===jR&&!p.retro.venus&&!p.retro.jupiter) buy(21,40,4,"मिथुन/धनु शुक्र+गुरु मार्गी → मंदी","Venus+Jupiter direct Gemini/Sag → -40pts","LM14");
  if(vR===6&&vD>=19&&vD<=21&&jR===6&&jD>=25&&!p.retro.jupiter) buy(13,25,4,"तुला शुक्र २०° + गुरु २६° → मंदी","Venus 20°+Jupiter 26° Libra → -25pts","LM15");
  if([3,10,5,7,2].includes(jR)&&jR===vR&&!p.retro.jupiter&&!p.retro.venus) buy(11,45,4,"गुरु+शुक्र उदय एक राशि → मंदी","Jupiter+Venus rising same rashi → -45pts","LM12");
  if(jR===5&&!p.retro.jupiter) buy(21,42,4,"कन्या मार्गी गुरु → मंदी","Jupiter direct Virgo → -42pts","LM7");
  if(raR===7&&jR===3&&vR===3) buy(7,15,3,"वृश्चिक राहु + कर्क गुरु+शुक्र → मंदी","Rahu Scorpio+Jupiter+Venus Cancer → mandi","WM16");
  if(jR===3&&saR===3&&vR===5&&meR===5) buy(7,17,4,"कर्क गुरु+शनि + कन्या शुक्र-बुध → मंदी","Jupiter+Saturn Cancer+Venus+Mercury Virgo → mandi","WM17");
  if(!p.retro.mercury&&!p.retro.jupiter&&!p.retro.venus&&[2,3,5].includes(vR)) buy(7,12,3,"मार्गी ग्रह + मंदी राशि → मंदी","Direct planets in mandi rashi → mandi","WM4");
  if([2,3,11].includes(jR)&&jD<3) buy(5,11,3,"गुरु मंदी राशि प्रवेश → मंदी","Jupiter enters mandi rashi → mandi","WM5");
  if(sR===2&&meR===5&&vR===5) buy(15,17,3,"मिथुन सूर्य + कन्या बुध-शुक्र → मंदी","Sun Gemini+Mercury+Venus Virgo → mandi","LM20");
  if([2,3,4].includes(sR)&&(jR===sR||meR===sR)) buy(11,22,3,"मिथुन/कर्क/सिंह सूर्य + गुरु/बुध → मंदी","Sun Gemini/Cancer/Leo+Jupiter/Mercury → mandi","LM18");
  if(isFull) buy(3,9,2,"पूर्णिमा → ९ टके मंदी","Poornima → -9pts","WM2");
  if(adiff(p.moon,p.venus)>170) buy(1,4,1,"चन्द्र-शुक्र प्रतियोग → मंदी","Moon-Venus opposition → mandi","DM7");
  if(adiff(p.moon,p.jupiter)>170) buy(1,4,1,"चन्द्र-गुरु प्रतियोग → मंदी","Moon-Jupiter opposition → mandi","DM7b");
  if(moR===2&&jR===2&&adiff(p.moon,p.jupiter)<10) buy(1,5,2,"मिथुन चन्द्र-गुरु युति → मंदी","Gemini Moon+Jupiter conjunction → mandi","DM1");
  return s;
}

function scan30(yr,mo,dy,istHr){
  const res=[];
  for(let i=0;i<=30;i++){
    const d=new Date(yr,mo-1,dy+i);
    const p=getPlanets(d.getFullYear(),d.getMonth()+1,d.getDate(),istHr);
    analyze(p).forEach(s=>{
      const key=s.rule+"_"+s.type;
      if(!res.find(r=>r.key===key&&r.daysFrom<=i+2))
        res.push({...s,key,daysFrom:i,date:d});
    });
  }
  return res.sort((a,b)=>b.str-a.str).slice(0,10);
}

// ── UI ────────────────────────────────────────────────────────────
const COL={SELL:{bg:"rgba(251,146,60,.10)",bdr:"rgba(251,146,60,.40)",txt:"#fb923c",lbl:"🏷️ बेचें · SELL"},BUY:{bg:"rgba(52,211,153,.10)",bdr:"rgba(52,211,153,.40)",txt:"#34d399",lbl:"📦 खरीदें · BUY"},HOLD:{bg:"rgba(250,204,21,.08)",bdr:"rgba(250,204,21,.40)",txt:"#facc15",lbl:"⏳ रुकें · WAIT"}};
const STARS=n=>"★".repeat(n)+"☆".repeat(5-n);

export default function CottonTrader(){
  const td=new Date();
  const [yr,setYr]=useState(td.getFullYear());
  const [mo,setMo]=useState(td.getMonth()+1);
  const [dy,setDy]=useState(td.getDate());
  const [hr,setHr]=useState(10);
  const [res,setRes]=useState(null);
  const [upcoming,setUpcoming]=useState(null);
  const [busy,setBusy]=useState(false);
  const [tab,setTab]=useState("today");
  const [prevSigs,setPrevSigs]=useState([[],[]]);

  function run(){
    setBusy(true);
    setTimeout(()=>{
      const p=getPlanets(yr,mo,dy,hr);
      const sigs=analyze(p);
      // FIX 6b: get previous 2 days for repetition engine
      const d1=new Date(yr,mo-1,dy-1), d2=new Date(yr,mo-1,dy-2);
      const s1=analyze(getPlanets(d1.getFullYear(),d1.getMonth()+1,d1.getDate(),hr));
      const s2=analyze(getPlanets(d2.getFullYear(),d2.getMonth()+1,d2.getDate(),hr));
      setPrevSigs([s1,s2]);
      const up=scan30(yr,mo,dy,hr);
      setRes({p,sigs}); setUpcoming(up); setBusy(false); setTab("today");
    },500);
  }

  const action=res?(()=>{let B=0,S=0;res.sigs.forEach(s=>{if(s.type==="BUY")B+=s.str;if(s.type==="SELL")S+=s.str;});if(S>B+2)return"SELL";if(B>S+2)return"BUY";return"HOLD";})():null;
  const C=action?COL[action]:COL.HOLD;
  const bestBuy=upcoming?.filter(s=>s.type==="BUY").sort((a,b)=>b.str-a.str)[0];
  const bestSell=upcoming?.filter(s=>s.type==="SELL").sort((a,b)=>b.str-a.str)[0];
  const repNote=res?buildRepetitionNote(res.sigs,...prevSigs):null;
  const delNote=res?delayNote(res.sigs):null;

  const inp={padding:"8px 4px",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:"6px",color:"#f0f0f0",fontSize:"14px",textAlign:"center",outline:"none",fontFamily:"Georgia,serif",width:"100%"};

  return(
    <div style={{minHeight:"100vh",background:"#0c1015",fontFamily:"Georgia,serif",color:"#e0d4c0",padding:"16px",maxWidth:"480px",margin:"0 auto"}}>

      <div style={{textAlign:"center",marginBottom:"18px"}}>
        <div style={{fontSize:"9px",color:"#444",letterSpacing:"4px",marginBottom:"4px"}}>व्यापार-चिन्तामाणे · VSOP87 · True Nodes · Lahiri</div>
        <div style={{fontSize:"24px",color:"#f0ead8",letterSpacing:"1px",marginBottom:"2px"}}>🪡 रूई व्यापार यंत्र</div>
        <div style={{fontSize:"11px",color:"#665544"}}>Physical Cotton Trader · Buy Low · Sell High</div>
        <div style={{width:"50px",height:"1px",background:"linear-gradient(90deg,transparent,#c8a97e,transparent)",margin:"10px auto 0"}}/>
      </div>

      <div style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:"12px",padding:"16px",marginBottom:"14px"}}>
        <div style={{fontSize:"9px",color:"#444",letterSpacing:"3px",textAlign:"center",marginBottom:"10px"}}>तिथि और समय (IST)</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1.4fr 0.9fr",gap:"6px",marginBottom:"12px"}}>
          {[["दिन",dy,setDy,1,31],["माह",mo,setMo,1,12],["वर्ष",yr,setYr,2000,2100],["बजे",hr,setHr,0,23]].map(([l,v,sv,mn,mx])=>(
            <div key={l}><div style={{fontSize:"9px",color:"#444",textAlign:"center",marginBottom:"3px"}}>{l}</div>
            <input type="number" value={v} min={mn} max={mx} onChange={e=>sv(parseInt(e.target.value)||v)} style={inp}/></div>
          ))}
        </div>
        <button onClick={run} disabled={busy} style={{width:"100%",padding:"12px",background:busy?"#1a1a1a":"linear-gradient(135deg,#b45309,#78350f)",border:"none",borderRadius:"8px",color:busy?"#444":"#fde68a",fontSize:"14px",fontWeight:"bold",cursor:busy?"not-allowed":"pointer",fontFamily:"Georgia,serif",letterSpacing:"1px"}}>
          {busy?"विश्लेषण...":"⚡ भाव विश्लेषण करें"}
        </button>
      </div>

      {res&&(<>
        <div style={{background:C.bg,border:`2px solid ${C.bdr}`,borderRadius:"14px",padding:"20px 16px",textAlign:"center",marginBottom:"12px",position:"relative",overflow:"hidden"}}>
          <div style={{position:"absolute",inset:0,background:`radial-gradient(ellipse at 50% 0%,${C.txt}18 0%,transparent 60%)`,pointerEvents:"none"}}/>
          <div style={{fontSize:"9px",color:"#444",letterSpacing:"4px",marginBottom:"8px"}}>आज की सलाह · TODAY'S ACTION</div>
          <div style={{fontSize:"36px",fontWeight:"bold",color:C.txt,marginBottom:"8px"}}>{C.lbl}</div>
          {action==="BUY"&&<div style={{fontSize:"13px",color:"#86efac"}}>मंदी का दौर — रूई खरीदें<br/><span style={{fontSize:"10px",color:"#555"}}>Bearish phase · accumulate cotton</span></div>}
          {action==="SELL"&&<div style={{fontSize:"13px",color:"#fdba74"}}>तेजी का दौर — रूई बेचें<br/><span style={{fontSize:"10px",color:"#555"}}>Bullish phase · offload cotton</span></div>}
          {action==="HOLD"&&<div style={{fontSize:"13px",color:"#fde68a"}}>मिश्रित — इंतज़ार करें<br/><span style={{fontSize:"10px",color:"#555"}}>Mixed signals · wait</span></div>}
          {res.p.eclipse&&<div style={{marginTop:"8px",padding:"6px 10px",background:"rgba(255,0,0,0.15)",borderRadius:"6px",fontSize:"11px",color:"#ff8888"}}>⚠️ {res.p.eclipse.type==="solar"?"सूर्यग्रहण":"चन्द्रग्रहण"} — {res.p.eclipse.total?"पूर्ण":"आंशिक"} (lat {res.p.moonLatDeg.toFixed(2)}°)</div>}
          {repNote&&<div style={{marginTop:"6px",fontSize:"10px",color:"#facc15",padding:"4px 8px",background:"rgba(250,204,21,0.08)",borderRadius:"5px"}}>{repNote}</div>}
          <div style={{display:"flex",gap:"20px",justifyContent:"center",marginTop:"12px"}}>
            {[["📦","BUY","#34d399"],["🏷️","SELL","#fb923c"]].map(([ic,t,c])=>{const sc=res.sigs.filter(s=>s.type===t).reduce((a,s)=>a+s.str,0);return<div key={t} style={{textAlign:"center"}}><div style={{fontSize:"20px",color:c,fontWeight:"bold"}}>{sc}</div><div style={{fontSize:"8px",color:c+"88"}}>{ic} Score</div></div>;})}
            <div style={{textAlign:"center"}}><div style={{fontSize:"20px",color:"#facc15",fontWeight:"bold"}}>{res.sigs.length}</div><div style={{fontSize:"8px",color:"#facc1588"}}>संकेत</div></div>
          </div>
        </div>

        {delNote&&<div style={{background:"rgba(250,204,21,0.07)",border:"1px solid rgba(250,204,21,0.3)",borderRadius:"8px",padding:"10px 12px",marginBottom:"10px",fontSize:"11px",color:"#fde68a"}}>🕐 {delNote}</div>}

        {(bestBuy||bestSell)&&(
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px",marginBottom:"12px"}}>
            {[[bestBuy,"BUY","📦 अगला खरीद"],[bestSell,"SELL","🏷️ अगला बिक्री"]].map(([best,type,label])=>{
              const C2=COL[type];
              return<div key={type} style={{background:C2.bg,border:`1px solid ${C2.bdr}`,borderRadius:"9px",padding:"10px 12px"}}>
                <div style={{fontSize:"9px",color:C2.txt,marginBottom:"5px"}}>{label}</div>
                {best?<><div style={{fontSize:"15px",color:"#f0f0f0",fontWeight:"bold"}}>{best.daysFrom===0?"आज":`${best.daysFrom} दिन बाद`}</div>
                <div style={{fontSize:"10px",color:C2.txt,marginTop:"2px"}}>{type==="SELL"?"+":"-"}{best.pts} टके · {best.dur}d · {STARS(best.str)}</div>
                <div style={{fontSize:"9px",color:"#444",marginTop:"3px",lineHeight:"1.3"}}>{best.hindi.slice(0,44)}…</div></>
                :<div style={{fontSize:"10px",color:"#333"}}>३० दिनों में नहीं</div>}
              </div>;
            })}
          </div>
        )}

        <div style={{background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:"10px",padding:"12px",marginBottom:"12px"}}>
          <div style={{fontSize:"9px",color:"#333",letterSpacing:"2px",marginBottom:"9px"}}>पंचांग · PANCHANG (Ayanamsa {res.p.ay.toFixed(3)}°)</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"5px",marginBottom:"8px"}}>
            {[["♀","शुक्र",res.p.venus,res.p.retro.venus,res.p.combust.venus,"#55ee88"],["♂","मंगल",res.p.mars,res.p.retro.mars,res.p.combust.mars,"#ff6666"],["♃","गुरु",res.p.jupiter,res.p.retro.jupiter,false,"#ffaa44"],["♄","शनि",res.p.saturn,res.p.retro.saturn,res.p.combust.saturn,"#aa88cc"],["☉","सूर्य",res.p.sun,false,false,"#ffd700"],["☽","चन्द्र",res.p.moon,false,false,"#cccccc"]].map(([sym,name,lon,r,c,col])=>(
              <div key={name} style={{background:"rgba(255,255,255,0.03)",borderRadius:"6px",padding:"6px 8px"}}>
                <div style={{fontSize:"10px",color:col}}>{sym} {name}</div>
                <div style={{fontSize:"10px",color:"#bbb"}}>{RASHIS[rashi(lon)]} {degr(lon).toFixed(1)}°</div>
                {(r||c)&&<div style={{fontSize:"8px",color:r?"#f87171":"#facc15"}}>{r?"◄ वक्री":""}{c?" अस्त":""}</div>}
              </div>
            ))}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"5px"}}>
            {[["चन्द्र नक्षत्र",`${NAKS[res.p.moonNak]} पद ${res.p.moNakPada}`],["नक्षत्र बदलाव",`${res.p.nakTrans.hoursFrom}h बाद → ${NAKS[res.p.nakTrans.nextNak]}`],["वार",`${VARAS[res.p.vara]}वार`],["तिथि",`${Math.floor(res.p.phase/12)+1} · ${res.p.phase.toFixed(0)}°`]].map(([l,v])=>(
              <div key={l} style={{background:"rgba(255,255,255,0.02)",borderRadius:"5px",padding:"5px 8px"}}>
                <div style={{fontSize:"8px",color:"#333"}}>{l}</div>
                <div style={{fontSize:"10px",color:"#999"}}>{v}</div>
              </div>
            ))}
          </div>
          {res.p.biases.length>0&&<div style={{marginTop:"6px",padding:"6px 8px",background:"rgba(200,169,126,0.06)",borderRadius:"5px"}}>
            <div style={{fontSize:"8px",color:"#c8a97e77",marginBottom:"3px"}}>मौसमी पंचांग पूर्वाग्रह</div>
            {res.p.biases.map((b,i)=><div key={i} style={{fontSize:"10px",color:b.dir==="SELL"?"#fb923c":"#34d399"}}>{b.dir==="SELL"?"⬆":"⬇"} {b.reason}</div>)}
          </div>}
        </div>

        <div style={{display:"flex",background:"rgba(255,255,255,0.03)",borderRadius:"8px",padding:"3px",gap:"3px",marginBottom:"10px"}}>
          {[["today",`आज (${res.sigs.length})`],["upcoming","अगले ३० दिन"]].map(([k,l])=>(
            <button key={k} onClick={()=>setTab(k)} style={{flex:1,padding:"8px",background:tab===k?"rgba(255,255,255,0.07)":"transparent",border:"none",borderRadius:"6px",color:tab===k?"#e0d4c0":"#444",fontSize:"11px",cursor:"pointer",fontFamily:"Georgia,serif"}}>{l}</button>
          ))}
        </div>

        {tab==="today"&&(
          <div>
            {["SELL","BUY"].map(type=>{
              const sigs=res.sigs.filter(s=>s.type===type).sort((a,b)=>b.str-a.str);
              if(!sigs.length)return null;
              const C2=COL[type];
              return<div key={type} style={{marginBottom:"10px"}}>
                <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"6px"}}>
                  <div style={{flex:1,height:"1px",background:C2.bdr}}/>
                  <span style={{fontSize:"10px",color:C2.txt,whiteSpace:"nowrap"}}>{type==="SELL"?"⬆ तेजी — बेचें":"⬇ मंदी — खरीदें"}</span>
                  <div style={{flex:1,height:"1px",background:C2.bdr}}/>
                </div>
                {sigs.map((s,i)=>(
                  <div key={i} style={{background:C2.bg,border:`1px solid ${C2.bdr}`,borderRadius:"8px",padding:"9px 11px",marginBottom:"5px"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"4px"}}>
                      <span style={{fontSize:"11px",color:C2.txt}}>{STARS(s.str)}</span>
                      <div style={{display:"flex",gap:"5px"}}>
                        <span style={{fontSize:"9px",background:"rgba(255,255,255,0.05)",padding:"2px 6px",borderRadius:"4px",color:"#555"}}>⏱{s.dur}d</span>
                        <span style={{fontSize:"9px",background:"rgba(255,255,255,0.05)",padding:"2px 6px",borderRadius:"4px",color:C2.txt}}>{type==="SELL"?"+":"-"}{s.pts}tk</span>
                      </div>
                    </div>
                    <div style={{fontSize:"12px",color:"#ddd",marginBottom:"2px"}}>{s.hindi}</div>
                    <div style={{fontSize:"10px",color:"#555"}}>{s.en}</div>
                  </div>
                ))}
              </div>;
            })}
            {res.sigs.length===0&&<div style={{textAlign:"center",color:"#333",padding:"24px",fontSize:"12px"}}>आज कोई स्पष्ट संकेत नहीं<br/><span style={{fontSize:"10px"}}>No clear signal today</span></div>}
          </div>
        )}

        {tab==="upcoming"&&upcoming&&(
          <div>
            <div style={{fontSize:"9px",color:"#333",letterSpacing:"2px",marginBottom:"8px"}}>अगले ३० दिनों के शीर्ष संकेत</div>
            {upcoming.map((s,i)=>{
              const C2=COL[s.type];
              const dt=s.date.toLocaleDateString("en-IN",{day:"numeric",month:"short"});
              return<div key={i} style={{display:"flex",gap:"8px",marginBottom:"7px",alignItems:"flex-start"}}>
                <div style={{width:"48px",flexShrink:0}}>
                  <div style={{background:C2.bg,border:`1px solid ${C2.bdr}`,borderRadius:"7px",padding:"5px 3px",textAlign:"center"}}>
                    <div style={{fontSize:"9px",color:C2.txt,fontWeight:"bold"}}>{s.daysFrom===0?"आज":`+${s.daysFrom}d`}</div>
                    <div style={{fontSize:"8px",color:"#333"}}>{dt}</div>
                  </div>
                </div>
                <div style={{flex:1,background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:"7px",padding:"8px 10px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:"3px",alignItems:"center"}}>
                    <span style={{fontSize:"10px",color:C2.txt,fontWeight:"bold"}}>{C2.lbl}</span>
                    <span style={{fontSize:"9px",color:"#444"}}>{STARS(s.str)} · {s.dur}d · {s.type==="SELL"?"+":"-"}{s.pts}tk</span>
                  </div>
                  <div style={{fontSize:"11px",color:"#bbb"}}>{s.hindi}</div>
                </div>
              </div>;
            })}
          </div>
        )}

        <div style={{marginTop:"14px",fontSize:"9px",color:"#2a2a2a",textAlign:"center",lineHeight:"1.7"}}>
          VSOP87 · Meeus Ch.47 Moon · True Nodes · IAU 1980 Nutation<br/>
          Lahiri Ayanamsa · Nakshatra Transition · Eclipse Engine<br/>
          व्यापार-चिन्तामाणे · पं॰ गंगाप्रसादजी ज्योतिषाचार्य · शैक्षिक उपयोग
        </div>
      </>)}
    </div>
  );
}
