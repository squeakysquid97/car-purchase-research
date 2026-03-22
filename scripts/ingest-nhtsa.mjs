import { createClient } from '@supabase/supabase-js';

// Curated list of popular makes for better signal coverage.
const TARGET_MAKES = [
  'TOYOTA',
  'HONDA',
  'FORD',
  'CHEVROLET',
  'NISSAN',
  'JEEP',
  'HYUNDAI',
  'KIA',
  'SUBARU',
  'BMW',
  'DODGE',
];

// Temporary test scope toggle. Set ENABLED=false to revert to full run.
const TEST_SCOPE = {
  ENABLED: false,
  VEHICLES: [
    { MAKE: 'Ford', MODEL: 'F-150', YEAR: 2015 },
  //   { MAKE: 'Honda', MODEL: 'CR-V', YEAR: 2014 },
  //   { MAKE: 'Mazda', MODEL: 'Mazda3', YEAR: 2012 },
  //   { MAKE: 'Subaru', MODEL: 'Outback', YEAR: 2015 },
  //   { MAKE: 'Chevrolet', MODEL: 'Malibu', YEAR: 2013 },
  //   { MAKE: 'Jeep', MODEL: 'Grand Cherokee', YEAR: 2014 },
  //   { MAKE: 'Volkswagen', MODEL: 'Jetta', YEAR: 2012 },
  //   { MAKE: 'BMW', MODEL: '328i', YEAR: 2011 },
  //  { MAKE: 'Hyundai', MODEL: 'Sonata', YEAR: 2013 },
  //   { MAKE: 'Kia', MODEL: 'Sorento', YEAR: 2015 },
  ],
};

const MODE = 'single_vehicle'; // 'single_vehicle' | 'queued_batch'
const MAX_VEHICLE_YEARS_PER_RUN = 25;

const VPIC_MODELS_BY_MAKE_URL = (makeName) =>
  `https://vpic.nhtsa.dot.gov/api/vehicles/GetModelsForMake/${encodeURIComponent(makeName)}?format=json`;
const RECALLS_URL = (make, model, year) =>
  `https://api.nhtsa.gov/recalls/recallsByVehicle?make=${encodeURIComponent(make)}&model=${encodeURIComponent(
    model
  )}&modelYear=${year}`;
const COMPLAINTS_URL = (make, model, year) =>
  `https://api.nhtsa.gov/complaints/complaintsByVehicle?make=${encodeURIComponent(
    make
  )}&model=${encodeURIComponent(model)}&modelYear=${year}`;

const MAX_MODELS_PER_MAKE = 20;
const START_YEAR = 2007;
const END_YEAR = 2017;
const REQUEST_DELAY_MS = 200;
const PROGRESS_EVERY = 100;
const MAX_ISSUES_PER_VEHICLE_YEAR = 10;
const MIN_SEVERE_COMPLAINT_CLUSTER_COUNT = 5;
const MIN_GENERIC_COMPLAINT_CLUSTER_COUNT = 6;
const MIN_GENERAL_COMPLAINT_CLUSTER_COUNT = 10;
const MIN_STRONG_GENERIC_COMPLAINT_CLUSTER_COUNT = 8;
const MIN_STRONG_GENERIC_COMPLAINT_SHARE = 0.08;
const MIN_VERY_WEAK_COMPLAINT_CLUSTER_COUNT = 12;
const MIN_VERY_WEAK_COMPLAINT_SHARE = 0.12;
const MIN_SYSTEMIC_COMPLAINT_CLUSTER_COUNT = 14;
const MIN_SYSTEMIC_COMPLAINT_SHARE = 0.1;

const SAFETY_CRITICAL_COMPONENT_HINTS = ['airbag', 'brake', 'steering', 'fuel', 'fire'];
const KEYWORD_STOPWORDS = new Set([
  'ABOUT',
  'AFTER',
  'AGAIN',
  'ALONG',
  'ALREADY',
  'ALSO',
  'ALTHOUGH',
  'ALWAYS',
  'AMONG',
  'ANOTHER',
  'BECAUSE',
  'BEFORE',
  'BEING',
  'BETWEEN',
  'BROUGHT',
  'COULD',
  'DIDNT',
  'DOING',
  'DURING',
  'EACH',
  'EVERY',
  'FIRST',
  'FROM',
  'GOING',
  'HADNT',
  'HAPPY',
  'HAVE',
  'HAVING',
  'INTO',
  'JUST',
  'MAKE',
  'MAKES',
  'MAKING',
  'MILES',
  'MODEL',
  'MONTH',
  'MONTHS',
  'NEVER',
  'OTHER',
  'OWNER',
  'OWNED',
  'PLEASE',
  'PROBLEM',
  'PROBLEMS',
  'REPAIR',
  'REPAIRED',
  'SAID',
  'SAME',
  'SHOULD',
  'SINCE',
  'STILL',
  'THAN',
  'THAT',
  'THEIR',
  'THERE',
  'THESE',
  'THEY',
  'THIS',
  'THOSE',
  'THROUGH',
  'TOYOTA',
  'HONDA',
  'FORD',
  'CHEVROLET',
  'NISSAN',
  'HYUNDAI',
  'KIA',
  'SUBARU',
  'BMW',
  'UNDER',
  'VEHICLE',
  'CAR',
  'VEHICLES',
  'ISSUE',
  'DRIVER',
  'DEALER',
  'NHTSA',
  'WAS',
  'WERE',
  'WHAT',
  'WHEN',
  'WHILE',
  'WITH',
  'WITHIN',
  'WOULD',
  'YEAR',
  'YEARS',
]);

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing required env vars: SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let failedRequests = 0;

function normalizeVehicleToken(value) {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ');
}

function normalizeMakeForDb(value) {
  const clean = normalizeVehicleToken(value).toLowerCase();
  return clean
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function normalizeModelForDb(value) {
  return normalizeVehicleToken(value);
}

async function safeGetJson(url, method = 'GET') {
  await sleep(REQUEST_DELAY_MS);

  try {
    const res = await fetch(url, {
      method,
      headers: { Accept: 'application/json' },
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      failedRequests += 1;
      console.error(
        `[safeGetJson] method=${method} url=${url} status=${res.status} error=${res.statusText} body=${body.slice(
          0,
          200
        )}`
      );

      // NHTSA endpoints sometimes return non-2xx with a valid results payload.
      try {
        const parsed = JSON.parse(body);
        if (parsed && typeof parsed === 'object') return parsed;
      } catch {
        // ignore parse errors
      }

      return null;
    }

    return await res.json();
  } catch (err) {
    failedRequests += 1;
    console.error(
      `[safeGetJson] method=${method} url=${url} status=n/a error=${err?.message ?? String(err)}`
    );
    return null;
  }
}

function extractResults(payload) {
  if (!payload) return [];
  if (Array.isArray(payload?.results)) return payload.results;
  if (Array.isArray(payload?.Results)) return payload.Results;
  return [];
}

function yearsRange(start, end) {
  const years = [];
  for (let year = start; year <= end; year += 1) years.push(year);
  return years;
}

function canonicalizeComponent(raw) {
  const normalized = String(raw ?? '')
    .toUpperCase()
    .trim()
    .replace(/[^A-Z0-9]+/g, ' ')
    .replace(/\s+/g, ' ');

  if (!normalized) return 'GENERAL';
  if (normalized.includes('AIR BAG')) return 'AIRBAGS';
  if (normalized.includes('SERVICE BRAKES') || normalized.includes('BRAKES')) return 'BRAKES';
  if (normalized.includes('STEERING')) return 'STEERING';
  if (normalized.includes('POWER TRAIN') || normalized.includes('POWERTRAIN')) {
    if (normalized.includes('TRANSMISSION')) return 'TRANSMISSION';
    return 'POWERTRAIN';
  }
  if (normalized.includes('TRANSMISSION')) return 'TRANSMISSION';
  if (normalized.includes('ENGINE')) return 'ENGINE';
  if (normalized.includes('ELECTRICAL')) return 'ELECTRICAL';
  if (normalized.includes('FUEL')) return 'FUEL_SYSTEM';
  if (normalized.includes('COOLING')) return 'COOLING';
  if (normalized.includes('SUSPENSION')) return 'SUSPENSION';
  if (normalized.includes('STRUCTURE') || normalized.includes('BODY')) return 'BODY';
  return 'GENERAL';
}

function getComponentFromRecall(item) {
  return (
    item?.Component ??
    item?.component ??
    item?.components ??
    item?.Components ??
    item?.componentDescription ??
    item?.component_description ??
    ''
  );
}

function getRecallSummary(item) {
  return item?.Summary ?? item?.summary ?? item?.description ?? '';
}

function getRecallConsequence(item) {
  return item?.Consequence ?? item?.consequence ?? item?.notes ?? '';
}

function getRecallCampaignId(item) {
  return (
    item?.NHTSACampaignNumber ??
    item?.nhtsaCampaignNumber ??
    item?.CampaignNumber ??
    item?.campaignNumber ??
    item?.RecallNumber ??
    item?.recallNumber ??
    ''
  );
}

function getComponentFromComplaint(item) {
  return (
    item?.components ??
    item?.Components ??
    item?.component ??
    item?.Component ??
    item?.componentDescription ??
    item?.component_description ??
    ''
  );
}

function getComplaintMileage(item) {
  const raw =
    item?.mileage ??
    item?.Mileage ??
    item?.miles ??
    item?.Miles ??
    item?.vehicle_miles ??
    item?.vehicleMiles ??
    null;
  if (raw === null || raw === undefined || raw === '') return null;
  const numeric = Number(String(raw).replace(/[^0-9.]/g, ''));
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  return Math.round(numeric);
}

function safeInt(value) {
  const numeric = Number.parseInt(String(value ?? '').replace(/[^0-9]/g, ''), 10);
  return Number.isFinite(numeric) ? numeric : null;
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid];
  return Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

function extractMileage(text) {
  const clean = String(text ?? '');
  if (!clean) return [];

  const matches = [];
  const regexes = [
    /\b(\d{1,3}(?:,\d{3})+|\d{4,6})\s*miles?\b/gi,
    /\b(?:at|around|about|approx(?:imately)?)\s*(\d{2,3})\s*k\b(?:\s*miles?)?/gi,
    /\b(\d{2,3})\s*k\b(?:\s*miles?)?/gi,
  ];

  for (const regex of regexes) {
    for (const match of clean.matchAll(regex)) {
      const raw = match[1];
      let miles = safeInt(raw);
      if (miles === null) continue;
      if (/k\b/i.test(match[0])) miles *= 1000;
      if (miles < 100 || miles > 500000) continue;
      matches.push(miles);
    }
  }

  return matches;
}

function extractRepairCosts(text) {
  const clean = String(text ?? '');
  if (!clean) return [];

  const matches = [];
  const regex = /\$\s*(\d{2,3}(?:,\d{3})+|\d{2,5})\b/g;

  for (const match of clean.matchAll(regex)) {
    const amount = safeInt(match[1]);
    if (amount === null || amount < 50 || amount > 25000) continue;
    matches.push(amount);
  }

  return matches;
}

function getComplaintNarrative(item) {
  return [
    item?.summary ?? '',
    item?.Summary ?? '',
    item?.complaint_summary ?? '',
    item?.narrative ?? '',
    item?.Narrative ?? '',
  ]
    .filter(Boolean)
    .join(' ');
}

const COMPLAINT_COMPONENT_PATTERNS = [
  {
    component: 'TRANSMISSION',
    patterns: [
      /\bcvt\b/,
      /\btransmission\b/,
      /\bgearbox\b/,
      /\bshift(?:ing)?\b/,
      /\bshudder\b/,
      /\bjudder\b/,
      /\brpm flare\b/,
      /\brevving high\b/,
      /\bslipp(?:ing|ed)?\b/,
      /\bslips\b/,
      /\bdelayed acceleration\b/,
      /\bno acceleration\b/,
      /\bpower loss\b/,
      /\bloss of power\b/,
      /\bhesitation\b/,
    ],
  },
  { component: 'ENGINE', patterns: [/\bengine\b/, /\bmotor\b/, /\bmisfire\b/, /\bcel\b/, /\bknocking\b/, /\bseized\b/, /\bthrew rod\b/] },
  { component: 'AIR_CONDITIONING', patterns: [/\bair conditioning\b/, /\bac compressor\b/, /\bhvac\b/] },
  { component: 'STEERING', patterns: [/\bsteering\b/, /\bpower steering\b/, /\bhard to steer\b/, /\blost steering assist\b/, /\bsteering wheel locked\b/] },
  { component: 'BRAKES', patterns: [/\bbrakes?\b/, /\bbrake pedal\b/, /\babs\b/, /\bbrake pedal went to floor\b/, /\bloss of braking\b/, /\bwould not stop\b/] },
  { component: 'FUEL_SYSTEM', patterns: [/\bfuel system\b/, /\bfuel pump\b/, /\bfuel injector\b/] },
  { component: 'COOLING', patterns: [/\bcooling\b/, /\bradiator\b/, /\bcoolant\b/, /\bwater pump\b/] },
  { component: 'SUSPENSION', patterns: [/\bsuspension\b/, /\bstrut\b/, /\bshock\b/, /\bcontrol arm\b/] },
  { component: 'ELECTRICAL', patterns: [/\belectrical\b/, /\balternator\b/, /\bbattery\b/] },
];

const COMPLAINT_SYMPTOM_PATTERNS = [
  { symptom: 'no_start', patterns: [/\bno start\b/, /\bwon t start\b/, /\bwould not start\b/, /\bnot start(?:ing)?\b/] },
  { symptom: 'stall', patterns: [/\bstall(?:ed|ing)?\b/, /\bshut off\b/, /\bdied while driving\b/, /\bengine shut off\b/] },
  {
    symptom: 'power_loss',
    patterns: [
      /\bpower loss\b/,
      /\bloss of power\b/,
      /\bwon t accelerate\b/,
      /\bno acceleration\b/,
      /\bhesitation\b/,
      /\bdelayed acceleration\b/,
      /\bhesitated to accelerate\b/,
      /\bwould not accelerate\b/,
      /\brevving\b/,
      /\brevving high\b/,
      /\brpm flare\b/,
    ],
  },
  { symptom: 'slipping', patterns: [/\bslipp(?:ing|ed)?\b/, /\bslips\b/, /\brev flare\b/, /\bengine revs but car doesn t move\b/] },
  { symptom: 'rough_shift', patterns: [/\brough shift(?:ing)?\b/, /\bhard shift(?:ing)?\b/, /\bjerk\b/, /\bshudder\b/, /\bjudder\b/] },
  { symptom: 'overheating', patterns: [/\boverheat(?:ing)?\b/, /\bran hot\b/, /\bhot temperature\b/] },
  { symptom: 'leak', patterns: [/\bleak(?:ing)?\b/, /\bfluid leak\b/, /\boil leak\b/, /\bcoolant leak\b/] },
  { symptom: 'vibration', patterns: [/\bvibration\b/, /\bshak(?:e|ing)\b/, /\bshimmy\b/] },
  { symptom: 'noise', patterns: [/\bnoise\b/, /\bwhin(?:e|ing)\b/, /\bgrind(?:ing)?\b/, /\bclunk(?:ing)?\b/] },
  { symptom: 'misfire', patterns: [/\bmisfire\b/, /\bmis firing\b/] },
  { symptom: 'oil_consumption', patterns: [/\boil consumption\b/, /\bburning oil\b/, /\bconsum(?:es|ing) oil\b/] },
  {
    symptom: 'electrical_fault',
    patterns: [/\belectrical (?:issue|fault|failure)\b/, /\bshort(?:ed|ing)?\b/, /\bbattery drain\b/],
  },
  { symptom: 'failure', patterns: [/\bfail(?:ed|ure)?\b/, /\bbroke\b/, /\bdefective\b/, /\bstopped working\b/] },
];

const COMPLAINT_COMPONENT_LABELS = {
  TRANSMISSION: 'Transmission',
  ENGINE: 'Engine',
  AIR_CONDITIONING: 'Air conditioning',
  AIRBAGS: 'Airbag',
  STEERING: 'Steering',
  BRAKES: 'Brakes',
  POWERTRAIN: 'Powertrain',
  FUEL_SYSTEM: 'Fuel system',
  COOLING: 'Cooling system',
  SUSPENSION: 'Suspension',
  ELECTRICAL: 'Electrical system',
  BODY: 'Body',
  GENERAL: 'General',
};

const COMPLAINT_SYMPTOM_LABELS = {
  failure: 'failure',
  slipping: 'slipping / power loss',
  rough_shift: 'rough shifting',
  power_loss: 'power loss',
  stall: 'stalling',
  no_start: 'no-start condition',
  overheating: 'overheating',
  leak: 'leak',
  vibration: 'vibration',
  noise: 'noise',
  misfire: 'misfire',
  oil_consumption: 'oil consumption',
  electrical_fault: 'electrical fault',
  general: 'issue',
};

const WEAK_COMPLAINT_SYMPTOMS = new Set(['general', 'noise', 'vibration']);
const VERY_WEAK_COMPLAINT_SYMPTOMS = new Set(['failure']);
const RECALL_COMPONENT_LABELS = {
  AIRBAGS: 'Airbag',
  BRAKES: 'Brake',
  STEERING: 'Steering',
  ENGINE: 'Engine',
  TRANSMISSION: 'Transmission',
  POWERTRAIN: 'Powertrain',
  FUEL_SYSTEM: 'Fuel system',
  ELECTRICAL: 'Electrical system',
  COOLING: 'Cooling system',
  SUSPENSION: 'Suspension',
  BODY: 'Body',
  GENERAL: 'General',
};

function normalizeComplaintText(text) {
  return String(text ?? '')
    .toLowerCase()
    .replace(/\ba\/c\b/g, ' air conditioning ')
    .replace(/\bac\b/g, ' air conditioning ')
    .replace(/\btrans\b/g, ' transmission ')
    .replace(/\bcheck engine light\b/g, ' cel ')
    .replace(/\bstalling\b/g, ' stall ')
    .replace(/\bstalls\b/g, ' stall ')
    .replace(/\bengine shut off\b/g, ' stall ')
    .replace(/\bjerking\b/g, ' jerk ')
    .replace(/\bjumps?\b/g, ' jerk ')
    .replace(/\bjumping\b/g, ' jerk ')
    .replace(/\bshuddering\b/g, ' shudder ')
    .replace(/\bjuddering\b/g, ' judder ')
    .replace(/\bhesitates? to accelerate\b/g, ' hesitation ')
    .replace(/\bhesitates?\b/g, ' hesitation ')
    .replace(/\bhesitated to accelerate\b/g, ' hesitation ')
    .replace(/\bwon'?t accelerate\b/g, ' no acceleration ')
    .replace(/\bwould not accelerate\b/g, ' no acceleration ')
    .replace(/\bno acceleration\b/g, ' no acceleration ')
    .replace(/\bdelayed acceleration\b/g, ' delayed acceleration ')
    .replace(/\blost power\b/g, ' power loss ')
    .replace(/\bloss of power\b/g, ' power loss ')
    .replace(/\bengine revs but car does(?:n'?t| not) move\b/g, ' slipping ')
    .replace(/\bengine revs but vehicle does(?:n'?t| not) move\b/g, ' slipping ')
    .replace(/\brev(?:s|ving) high\b/g, ' rpm flare ')
    .replace(/\brpm flar(?:e|ing)\b/g, ' rpm flare ')
    .replace(/\bhard to steer\b/g, ' steering hard ')
    .replace(/\blost steering assist\b/g, ' steering assist loss ')
    .replace(/\bsteering wheel locked\b/g, ' steering locked ')
    .replace(/\bbrake pedal went to floor\b/g, ' loss of braking ')
    .replace(/\bwould not stop\b/g, ' loss of braking ')
    .replace(/[^a-z0-9\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeRecallText(text) {
  return String(text ?? '')
    .toLowerCase()
    .replace(/\bair bag\b/g, ' airbag ')
    .replace(/\becm\b/g, ' engine control module ')
    .replace(/\babs\b/g, ' anti lock brake system ')
    .replace(/[^a-z0-9\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function inferRecallComponent(text) {
  const normalized = normalizeRecallText(text);
  if (!normalized) return null;
  if (/\bairbag\b|\binflator\b/.test(normalized)) return 'AIRBAGS';
  if (/\bbrake\b|\bbraking\b|\bbrake actuator\b/.test(normalized)) return 'BRAKES';
  if (/\bsteering\b|\bsteering column\b|\bpower steering\b/.test(normalized)) return 'STEERING';
  if (/\bengine\b|\bengine control module\b|\bstall\b/.test(normalized)) return 'ENGINE';
  if (/\btransmission\b|\bpowertrain\b|\bcvt\b/.test(normalized)) return 'TRANSMISSION';
  if (/\bfuel\b|\bfuel pump\b|\bfuel leak\b/.test(normalized)) return 'FUEL_SYSTEM';
  if (/\belectrical\b|\bwiring\b|\bbattery\b/.test(normalized)) return 'ELECTRICAL';
  return null;
}

function recallRiskFamily(component, text) {
  const normalized = normalizeRecallText(text);
  if (/\bfire\b|\bburn\b/.test(normalized)) return 'fire_risk';
  if (/\binjury or death\b|\bserious injury\b/.test(normalized)) return 'severe_injury_risk';
  if (/\bloss of braking\b|\breduced braking\b|\bbrake failure\b/.test(normalized)) return 'loss_of_braking';
  if (/\bsteering control may be lost\b|\bloss of steering\b/.test(normalized)) return 'loss_of_steering';
  if (/\binflator may explode\b|\bairbag inflator\b|\bunintended deployment\b/.test(normalized)) {
    return 'airbag_inflator_risk';
  }
  if (/\bstall(?:ing)?\b|\bengine shut off\b/.test(normalized)) return 'stalling_risk';
  if (/\bfuel leak\b/.test(normalized)) return 'fuel_leak_risk';
  if (/\bengine control module\b/.test(normalized)) return 'control_module_risk';
  if (component === 'GENERAL') return 'general_recall';
  return 'general_component_risk';
}

function canonicalRecallIssueName(group) {
  if (group.issueFamilyKey === 'vehicle_fire') return 'Recall: Vehicle fire risk (NHTSA)';
  if (group.issueFamilyKey === 'powertrain_stalling') return 'Recall: Engine stalling risk (NHTSA)';

  const label = RECALL_COMPONENT_LABELS[group.component] ?? 'Component';
  switch (group.riskFamily) {
    case 'airbag_inflator_risk':
      return 'Recall: Airbag inflator failure risk (NHTSA)';
    case 'stalling_risk':
      if (group.component === 'ENGINE') return 'Recall: Engine control module stalling risk (NHTSA)';
      return `Recall: ${label} stalling risk (NHTSA)`;
    case 'loss_of_braking':
      return 'Recall: Brake actuator failure risk (NHTSA)';
    case 'loss_of_steering':
      return 'Recall: Steering control loss risk (NHTSA)';
    case 'fire_risk':
      return `Recall: ${label} fire risk (NHTSA)`;
    case 'fuel_leak_risk':
      return 'Recall: Fuel leak / fire risk (NHTSA)';
    case 'control_module_risk':
      return 'Recall: Engine control module failure risk (NHTSA)';
    default:
      if (group.component === 'GENERAL') return null;
      return `Recall: ${label} safety risk (NHTSA)`;
  }
}

function classifyRecallSeverity(group) {
  const text = group.normalizedText;
  const catastrophic =
    /\binjury or death\b|\bserious injury\b/.test(text) ||
    /\bfire\b/.test(text) ||
    /\bloss of braking\b|\bbrake failure\b/.test(text) ||
    /\bsteering control may be lost\b|\bloss of steering\b/.test(text) ||
    /\binflator may explode\b|\bairbag inflator\b/.test(text) ||
    /\bfuel leak\b.*\bfire\b|\bfire\b.*\bfuel\b/.test(text);

  if (catastrophic) return 'catastrophic';
  if (isSafetyCritical(group.component) || group.riskFamily !== 'general_component_risk') return 'high';
  return 'medium';
}

function isMeaningfulRecallIssue(group, hasSpecificRecallGroup) {
  if (group.component === 'GENERAL' && hasSpecificRecallGroup) return false;
  if (group.component === 'GENERAL' && group.riskFamily === 'general_recall') return false;
  if (!group.issueName) return false;
  if (group.component === 'BODY' && group.records.length < 2) return false;
  return true;
}

function recallIssueFamilyKey(group) {
  const text = group.normalizedText;

  if (
    group.riskFamily === 'fire_risk' ||
    group.riskFamily === 'fuel_leak_risk' ||
    ((group.component === 'ENGINE' || group.component === 'ELECTRICAL' || group.component === 'FUEL_SYSTEM') &&
      /\bfire\b|\bburn\b|\bfuel leak\b/.test(text))
  ) {
    return 'vehicle_fire';
  }

  if (
    group.riskFamily === 'stalling_risk' ||
    group.riskFamily === 'control_module_risk' ||
    ((group.component === 'ENGINE' || group.component === 'ELECTRICAL') &&
      /\bstall(?:ing)?\b|\bengine shut off\b|\bengine control module\b/.test(text))
  ) {
    return 'powertrain_stalling';
  }

  return group.familyKey;
}

function recallSeverityRank(group) {
  switch (classifyRecallSeverity(group)) {
    case 'catastrophic':
      return 3;
    case 'high':
      return 2;
    case 'medium':
      return 1;
    default:
      return 0;
  }
}

function recallComponentSpecificity(group) {
  return group.component === 'GENERAL' ? 0 : 1;
}

function shouldReplaceMergedRecallRepresentative(current, candidate) {
  const currentRiskSpecific = current.riskFamily !== 'general_component_risk';
  const candidateRiskSpecific = candidate.riskFamily !== 'general_component_risk';
  if (candidateRiskSpecific !== currentRiskSpecific) return candidateRiskSpecific;

  const severityDiff = recallSeverityRank(candidate) - recallSeverityRank(current);
  if (severityDiff !== 0) return severityDiff > 0;

  const componentDiff = recallComponentSpecificity(candidate) - recallComponentSpecificity(current);
  if (componentDiff !== 0) return componentDiff > 0;

  return false;
}

function mergeRecallGroups(groups) {
  const merged = new Map();

  for (const group of groups) {
    const issueFamilyKey = recallIssueFamilyKey(group);
    const existing = merged.get(issueFamilyKey);

    if (!existing) {
      merged.set(issueFamilyKey, {
        ...group,
        familyKey: issueFamilyKey,
        issueFamilyKey,
      });
      continue;
    }

    if (shouldReplaceMergedRecallRepresentative(existing, group)) {
      existing.component = group.component;
      existing.riskFamily = group.riskFamily;
    }

    existing.records.push(...group.records);
    existing.items.push(...group.items);
    existing.normalizedText = `${existing.normalizedText} ${group.normalizedText}`.trim();
    for (const text of group.sampleTexts) {
      if (text && existing.sampleTexts.length < 3 && !existing.sampleTexts.includes(text)) {
        existing.sampleTexts.push(text);
      }
    }

    merged.set(issueFamilyKey, existing);
  }

  return [...merged.values()]
    .map((group) => ({
      ...group,
      issueName: canonicalRecallIssueName(group),
    }));
}

function strongerRecallGroupOverlapsComponent(group, component) {
  if (group.issueFamilyKey === 'vehicle_fire') {
    return ['ENGINE', 'ELECTRICAL', 'FUEL_SYSTEM', 'POWERTRAIN', 'TRANSMISSION'].includes(component);
  }
  if (group.issueFamilyKey === 'powertrain_stalling') {
    return ['ENGINE', 'ELECTRICAL', 'POWERTRAIN', 'TRANSMISSION'].includes(component);
  }
  if (group.riskFamily === 'loss_of_braking' || group.component === 'BRAKES') return component === 'BRAKES';
  if (group.riskFamily === 'loss_of_steering' || group.component === 'STEERING') return component === 'STEERING';
  if (group.riskFamily === 'airbag_inflator_risk' || group.component === 'AIRBAGS') return component === 'AIRBAGS';
  if (group.riskFamily !== 'general_component_risk') return group.component === component;
  return false;
}

function shouldSuppressGenericRecallGroup(group, allGroups) {
  if (group.riskFamily !== 'general_component_risk') return false;

  return allGroups.some(
    (other) =>
      other !== group &&
      other.issueName &&
      (other.riskFamily !== 'general_component_risk' || isSafetyCritical(other.component)) &&
      strongerRecallGroupOverlapsComponent(other, group.component)
  );
}

function groupRecalls(recallsResults, { forDisplay = false } = {}) {
  const groupMap = new Map();

  for (const recall of recallsResults) {
    const summary = getRecallSummary(recall);
    const consequence = getRecallConsequence(recall);
    const combinedText = `${summary} ${consequence}`;
    const normalizedText = normalizeRecallText(combinedText);
    if (!normalizedText) continue;

    let component = canonicalizeComponent(getComponentFromRecall(recall));
    if (component === 'GENERAL') {
      component = inferRecallComponent(`${getComponentFromRecall(recall)} ${combinedText}`) ?? 'GENERAL';
    }

    const campaignId = normalizeVehicleToken(getRecallCampaignId(recall));
    const riskFamily = recallRiskFamily(component, combinedText);
    const familyKey = campaignId || `${component}::${riskFamily}`;
    const groupKey = `${component}::${riskFamily}::${familyKey}`;
    const existing = groupMap.get(groupKey) ?? {
      kind: 'recall',
      component,
      riskFamily,
      familyKey,
      records: [],
      items: [],
      normalizedText,
      sampleTexts: [],
    };

    existing.records.push(recall);
    existing.items.push(recall);
    if (summary && existing.sampleTexts.length < 2 && !existing.sampleTexts.includes(summary)) {
      existing.sampleTexts.push(toSentences(summary, 160));
    }
    if (consequence && existing.sampleTexts.length < 2 && !existing.sampleTexts.includes(consequence)) {
      existing.sampleTexts.push(toSentences(consequence, 160));
    }
    existing.normalizedText = `${existing.normalizedText} ${normalizedText}`.trim();
    groupMap.set(groupKey, existing);
  }

  const groups = mergeRecallGroups(
    [...groupMap.values()].map((group) => ({
      ...group,
      issueFamilyKey: group.familyKey,
      issueName: canonicalRecallIssueName(group),
    }))
  );
  const hasSpecificRecallGroup = groups.some((group) => group.component !== 'GENERAL' && group.issueName);

  const filteredGroups = forDisplay
    ? groups
        .filter((group) => !shouldSuppressGenericRecallGroup(group, groups))
        .filter((group) => isMeaningfulRecallIssue(group, hasSpecificRecallGroup))
    : groups.filter((group) => group.issueName);

  return filteredGroups.sort((a, b) => b.records.length - a.records.length);
}

function isSystemicRecallGroup(group) {
  return group.records.length >= 2 && (classifyRecallSeverity(group) === 'catastrophic' || isSafetyCritical(group.component));
}

function inferComplaintComponent(text) {
  for (const entry of COMPLAINT_COMPONENT_PATTERNS) {
    if (entry.patterns.some((pattern) => pattern.test(text))) return entry.component;
  }
  return null;
}

function extractSymptom(text) {
  for (const entry of COMPLAINT_SYMPTOM_PATTERNS) {
    if (entry.patterns.some((pattern) => pattern.test(text))) return entry.symptom;
  }
  return null;
}

function buildComplaintClusterKey(complaint) {
  const componentFromApi = canonicalizeComponent(getComponentFromComplaint(complaint));
  const narrativeText = getComplaintNarrative(complaint);
  const normalizedText = normalizeComplaintText(`${getComponentFromComplaint(complaint)} ${narrativeText}`);

  if (!normalizedText) return null;

  let component = componentFromApi;
  if (component === 'POWERTRAIN' && /\bcvt\b|\btransmission\b|\bshift\b/.test(normalizedText)) {
    component = 'TRANSMISSION';
  }
  if (component === 'GENERAL') {
    component = inferComplaintComponent(normalizedText) ?? 'GENERAL';
  }
  if (component === 'GENERAL') return null;

  const symptom = extractSymptom(normalizedText);
  return `${component}::${symptom ?? 'general'}`;
}

function clusterComplaintShare(clusterCount, totalComplaintCount) {
  if (!totalComplaintCount) return 0;
  return clusterCount / totalComplaintCount;
}

function hasSpecificComplaintContext(component, symptom, sampleText) {
  const normalized = String(sampleText ?? '');
  if (!normalized) return false;

  if (symptom === 'failure') {
    switch (component) {
      case 'ENGINE':
        return /\bstall\b|\bno start\b|\bmisfire\b|\boverheat\b|\bpower loss\b|\bhesitation\b|\bseized\b/.test(
          normalized
        );
      case 'TRANSMISSION':
        return /\bcvt\b|\bslipp(?:ing)?\b|\brough shift\b|\bhard shift\b|\bshudder\b|\bjudder\b|\brpm flare\b|\bpower loss\b/.test(
          normalized
        );
      case 'BRAKES':
        return /\bloss of braking\b|\bbrake pedal\b|\bwould not stop\b|\babs\b/.test(normalized);
      case 'STEERING':
        return /\bsteering assist loss\b|\bsteering hard\b|\bsteering locked\b|\bpower steering\b/.test(normalized);
      case 'ELECTRICAL':
        return /\bshort(?:ed|ing)?\b|\bbattery drain\b|\balternator\b|\bwiring\b|\bno start\b/.test(normalized);
      default:
        return false;
    }
  }

  return true;
}

function complaintClusterMinCount(component, symptom) {
  if (symptom === 'general') return MIN_GENERAL_COMPLAINT_CLUSTER_COUNT;
  if (WEAK_COMPLAINT_SYMPTOMS.has(symptom) || VERY_WEAK_COMPLAINT_SYMPTOMS.has(symptom)) {
    return MIN_VERY_WEAK_COMPLAINT_CLUSTER_COUNT;
  }
  if (isSevereComplaintCluster(component, symptom)) return MIN_SEVERE_COMPLAINT_CLUSTER_COUNT;
  return MIN_STRONG_GENERIC_COMPLAINT_CLUSTER_COUNT;
}

function complaintClusterMinShare(component, symptom) {
  if (isSevereComplaintCluster(component, symptom)) return 0.06;
  if (symptom === 'general') return 0.12;
  if (WEAK_COMPLAINT_SYMPTOMS.has(symptom) || VERY_WEAK_COMPLAINT_SYMPTOMS.has(symptom)) {
    return MIN_VERY_WEAK_COMPLAINT_SHARE;
  }
  return MIN_STRONG_GENERIC_COMPLAINT_SHARE;
}

function complaintClusterConfidence(component, symptom, count, share) {
  const minCount = complaintClusterMinCount(component, symptom);
  const minShare = complaintClusterMinShare(component, symptom);

  if (isSevereComplaintCluster(component, symptom)) {
    if (count >= minCount && share >= minShare) return 'strong';
    if (count >= minCount) return 'medium';
    return 'weak';
  }

  if (symptom === 'general') {
    if (count >= minCount && share >= minShare) return 'medium';
    return 'weak';
  }

  if (WEAK_COMPLAINT_SYMPTOMS.has(symptom) || VERY_WEAK_COMPLAINT_SYMPTOMS.has(symptom)) {
    if (count >= minCount && share >= minShare) return 'medium';
    return 'weak';
  }

  if (count >= minCount && share >= minShare) return 'medium';
  return 'weak';
}

function isMeaningfulComplaintCluster(cluster, totals) {
  if (cluster.component === 'GENERAL') return false;
  const share = clusterComplaintShare(cluster.items.length, totals.totalComplaintCount);
  const minCount = complaintClusterMinCount(cluster.component, cluster.symptom);
  const minShare = complaintClusterMinShare(cluster.component, cluster.symptom);
  const confidence = complaintClusterConfidence(cluster.component, cluster.symptom, cluster.items.length, share);
  const hasSpecificContext = hasSpecificComplaintContext(
    cluster.component,
    cluster.symptom,
    cluster.normalizedSampleText
  );

  if (!hasSpecificContext) return false;
  if (WEAK_COMPLAINT_SYMPTOMS.has(cluster.symptom)) return false;
  return cluster.items.length >= minCount && share >= minShare && confidence !== 'weak';
}

function complaintIssueFamilyKey(component, symptom, sampleText) {
  if (component === 'TRANSMISSION' && ['failure', 'slipping', 'rough_shift', 'power_loss'].includes(symptom)) {
    return /\bcvt\b/.test(sampleText)
      ? 'TRANSMISSION::major_drivability::cvt'
      : 'TRANSMISSION::major_drivability';
  }
  if (component === 'ENGINE' && ['stall', 'no_start', 'power_loss'].includes(symptom)) {
    return 'ENGINE::drivability';
  }
  return `${component}::${symptom}`;
}

function mergeComplaintClusters(clusters) {
  const merged = new Map();

  for (const cluster of clusters) {
    const familyKey = complaintIssueFamilyKey(cluster.component, cluster.symptom, cluster.normalizedSampleText);
    const existing = merged.get(familyKey);

    if (!existing) {
      merged.set(familyKey, {
        ...cluster,
        clusterKey: familyKey,
        issueFamilyKey: familyKey,
        sampleTexts: [...cluster.sampleTexts],
        items: [...cluster.items],
        normalizedSampleText: cluster.normalizedSampleText,
        mergedSymptoms: new Set([cluster.symptom]),
      });
      continue;
    }

    if (existing) {
      existing.items.push(...cluster.items);
      for (const text of cluster.sampleTexts) {
        if (text && existing.sampleTexts.length < 3 && !existing.sampleTexts.includes(text)) {
          existing.sampleTexts.push(text);
        }
      }
      existing.mergedSymptoms.add(cluster.symptom);
      if (!existing.normalizedSampleText && cluster.normalizedSampleText) {
        existing.normalizedSampleText = cluster.normalizedSampleText;
      }
    }

    if (
      existing.mergedSymptoms.has('failure') ||
      existing.mergedSymptoms.has('slipping') ||
      existing.mergedSymptoms.has('power_loss')
    ) {
      existing.symptom = 'power_loss';
    } else if (existing.component === 'ENGINE' && existing.mergedSymptoms.has('stall')) {
      existing.symptom = 'stall';
    } else if (existing.component === 'ENGINE' && existing.mergedSymptoms.has('no_start')) {
      existing.symptom = 'no_start';
    } else if (existing.mergedSymptoms.has('rough_shift')) {
      existing.symptom = 'rough_shift';
    }

    merged.set(familyKey, existing);
  }

  return [...merged.values()].map((cluster) => ({
    ...cluster,
    sampleTexts: cluster.sampleTexts.slice(0, 3),
  }));
}

function clusterComplaints(complaintsResults, { forDisplay = false } = {}) {
  const clusterMap = new Map();

  for (const complaint of complaintsResults) {
    const clusterKey = buildComplaintClusterKey(complaint);
    if (!clusterKey) continue;

    const [component, symptom] = clusterKey.split('::');
    const existing = clusterMap.get(clusterKey) ?? {
      kind: 'complaint',
      component,
      symptom,
      clusterKey,
      items: [],
      sampleTexts: [],
      normalizedSampleText: '',
    };

    existing.items.push(complaint);

    const sampleText = toSentences(getComplaintNarrative(complaint), 160);
    if (sampleText && existing.sampleTexts.length < 3 && !existing.sampleTexts.includes(sampleText)) {
      existing.sampleTexts.push(sampleText);
    }

    if (!existing.normalizedSampleText) {
      existing.normalizedSampleText = normalizeComplaintText(
        `${getComponentFromComplaint(complaint)} ${getComplaintNarrative(complaint)}`
      );
    }

    clusterMap.set(clusterKey, existing);
  }

  const totalComplaintCount = complaintsResults.length;
  const totals = { totalComplaintCount };

  const clusters = mergeComplaintClusters([...clusterMap.values()])
    .map((cluster) => {
      const share = clusterComplaintShare(cluster.items.length, totalComplaintCount);
      return {
        ...cluster,
        complaintShare: share,
        confidence: complaintClusterConfidence(cluster.component, cluster.symptom, cluster.items.length, share),
      };
    })
    .filter((cluster) => {
      if (cluster.component === 'GENERAL') {
        console.warn(`[debug] GENERAL complaint cluster survived: ${cluster.clusterKey} (${cluster.items.length})`);
        return false;
      }
      return true;
    })
    .filter((cluster) => cluster.symptom !== 'general');

  const filteredClusters = forDisplay
    ? clusters
        .filter((cluster) => isMeaningfulComplaintCluster(cluster, totals))
        .filter((cluster) => !WEAK_COMPLAINT_SYMPTOMS.has(cluster.symptom))
    : clusters;

  return filteredClusters.sort((a, b) => b.items.length - a.items.length);
}

function canonicalIssueNameForCluster(component, symptom, sampleText, severity) {
  const isCvt = /\bcvt\b/.test(sampleText);
  const fallbackComponentLabel =
    component && component !== 'GENERAL'
      ? component
          .toLowerCase()
          .split('_')
          .filter(Boolean)
          .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
          .join(' ')
      : 'General';
  const componentLabel = COMPLAINT_COMPONENT_LABELS[component] ?? fallbackComponentLabel;
  const hasStallSignal = /\bstall\b|\bengine shut off\b|\bdied while driving\b/.test(sampleText);
  const hasNoStartSignal = /\bno start\b|\bwould not start\b|\bwon t start\b/.test(sampleText);
  const hasMisfireSignal = /\bmisfire\b/.test(sampleText);
  const hasHesitationSignal = /\bhesitation\b|\bdelayed acceleration\b/.test(sampleText);
  const hasPowerLossSignal = /\bpower loss\b|\bloss of power\b|\bno acceleration\b/.test(sampleText);
  const hasShiftSignal = /\brough shift\b|\bhard shift\b|\bshudder\b|\bjudder\b|\bslipp(?:ing)?\b/.test(sampleText);

  if (severity === 'low') {
    if (component === 'ENGINE') {
      if (symptom === 'stall') return 'Engine stalling';
      if (symptom === 'no_start') return 'Engine no-start condition';
      if (symptom === 'power_loss') {
        if (hasStallSignal) return 'Engine stalling';
        if (hasNoStartSignal) return 'Engine no-start condition';
        if (hasMisfireSignal) return 'Engine misfire';
        if (hasHesitationSignal || hasPowerLossSignal) return 'Engine power loss / hesitation';
        return null;
      }
      return 'Engine issue';
    }
    if (component === 'TRANSMISSION') return 'Transmission issue';
    if (component === 'BRAKES') return 'Brake issue';
    if (component === 'STEERING') return 'Steering issue';
    return `${componentLabel} issue`;
  }

  if (component === 'TRANSMISSION') {
    const prefix = isCvt ? 'CVT transmission' : 'Transmission';
    if (symptom === 'slipping' || symptom === 'power_loss') return `${prefix} slipping / power loss`;
    if (symptom === 'rough_shift') return `${prefix} rough shifting`;
    if (symptom === 'failure') return `${prefix} failure`;
  }

  if (component === 'ENGINE' && (symptom === 'stall' || hasStallSignal)) return 'Engine stalling while driving';
  if (component === 'ENGINE' && (symptom === 'no_start' || hasNoStartSignal)) return 'Engine no-start condition';
  if (component === 'ENGINE' && hasMisfireSignal) return 'Engine misfire';
  if (component === 'ENGINE' && symptom === 'power_loss') {
    if (hasHesitationSignal || hasPowerLossSignal) return 'Engine power loss / hesitation';
    return null;
  }
  if (component === 'ENGINE' && symptom === 'oil_consumption') return 'Oil consumption';
  if (component === 'ENGINE' && symptom === 'misfire') return 'Engine misfire';
  if (component === 'AIR_CONDITIONING' && symptom === 'failure') return 'Air conditioning failure';
  if (component === 'BRAKES' && symptom === 'failure') return hasPowerLossSignal ? 'Brake performance issue' : 'Brake failure risk';
  if (component === 'BRAKES' && symptom === 'power_loss') return 'Loss of braking power';
  if (component === 'STEERING' && symptom === 'power_loss') return 'Power steering loss';
  if (component === 'POWERTRAIN' && symptom === 'failure' && hasShiftSignal) return 'Powertrain shifting issue';

  const symptomLabel = COMPLAINT_SYMPTOM_LABELS[symptom] ?? 'issue';
  return symptom === 'general' ? `${componentLabel} issue` : `${componentLabel} ${symptomLabel}`;
}

function isSevereComplaintCluster(component, symptom) {
  if (['TRANSMISSION', 'POWERTRAIN'].includes(component)) {
    return ['failure', 'slipping', 'rough_shift', 'power_loss'].includes(symptom);
  }
  if (component === 'ENGINE') {
    return ['stall', 'no_start', 'overheating'].includes(symptom);
  }
  if (component === 'BRAKES') {
    return ['failure', 'power_loss'].includes(symptom);
  }
  if (component === 'STEERING') {
    return ['power_loss', 'failure'].includes(symptom);
  }
  return false;
}

function complaintSeverityForCluster(component, symptom) {
  if (isSevereComplaintCluster(component, symptom)) return 'high';
  if (['leak', 'noise', 'vibration', 'misfire', 'oil_consumption', 'electrical_fault', 'failure'].includes(symptom)) {
    return 'medium';
  }
  return 'low';
}

function complaintIsSystemic(bucket) {
  if (bucket.confidence !== 'strong') return false;
  return (
    bucket.items.length >= MIN_SYSTEMIC_COMPLAINT_CLUSTER_COUNT &&
    bucket.complaintShare >= MIN_SYSTEMIC_COMPLAINT_SHARE
  );
}

function mapComplaintClusterToIssue(bucket) {
  if (bucket.component === 'GENERAL' || bucket.symptom === 'general') return null;

  const isLargeTransmissionDrivabilityCluster =
    bucket.component === 'TRANSMISSION' &&
    ['failure', 'slipping', 'rough_shift', 'power_loss'].includes(bucket.symptom) &&
    bucket.items.length >= 50;
  const baseSeverity = complaintSeverityForCluster(bucket.component, bucket.symptom);
  const severity = isLargeTransmissionDrivabilityCluster
    ? 'high'
    : bucket.confidence === 'weak'
      ? 'low'
      : bucket.confidence === 'medium' && baseSeverity === 'high'
        ? 'medium'
        : baseSeverity;
  const issueName = canonicalIssueNameForCluster(bucket.component, bucket.symptom, bucket.normalizedSampleText, severity);
  if (!issueName) return null;
  const componentLabel = (COMPLAINT_COMPONENT_LABELS[bucket.component] ?? 'general system').toLowerCase();
  const symptomLabel = COMPLAINT_SYMPTOM_LABELS[bucket.symptom] ?? 'issue';
  const description =
    bucket.symptom === 'general'
      ? `Repeated NHTSA complaints point to a recurring ${componentLabel} repair concern. Clustered from ${bucket.items.length} similar complaints.`
      : `Repeated NHTSA complaints point to ${componentLabel} ${symptomLabel}. Clustered from ${bucket.items.length} similar complaints.`;

  return {
    issueName: `${issueName} (NHTSA)`,
    description,
    severity,
    isSystemic: isLargeTransmissionDrivabilityCluster || complaintIsSystemic(bucket),
  };
}

function toSentences(text, maxChars = 180) {
  const clean = normalizeVehicleToken(text).replace(/\s+/g, ' ');
  if (!clean) return '';
  return clean.slice(0, maxChars);
}

function extractKeywords(text) {
  const clean = String(text ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!clean) return new Map();

  const frequencies = new Map();
  for (const word of clean.split(' ')) {
    if (!word || word.length < 4) continue;
    if (KEYWORD_STOPWORDS.has(word)) continue;
    frequencies.set(word, (frequencies.get(word) ?? 0) + 1);
  }
  return frequencies;
}

function topKeywordsForBucket(bucket) {
  if (bucket.kind !== 'complaint') return [];

  const combined = new Map();
  const sample = bucket.items.slice(0, 25);
  for (const item of sample) {
    const text = [
      item?.summary ?? '',
      item?.complaint_summary ?? '',
      item?.narrative ?? '',
      item?.Summary ?? '',
    ]
      .filter(Boolean)
      .join(' ');

    const keywordMap = extractKeywords(text);
    for (const [word, count] of keywordMap.entries()) {
      combined.set(word, (combined.get(word) ?? 0) + count);
    }
  }

  const componentToken = String(bucket.component ?? '').replace(/[^A-Z0-9]/g, '');

  return [...combined.entries()]
    .filter(([word]) => String(word).replace(/[^A-Z0-9]/g, '') !== componentToken)
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return a[0].localeCompare(b[0]);
    })
    .slice(0, 2)
    .map(([word]) => word);
}

function summarizeBucket(kind, component, items) {
  const sample = items.slice(0, 2);
  const parts = [];
  parts.push(
    `${kind === 'recall' ? 'Recall' : 'Complaint'} bucket for ${component} includes ${items.length} NHTSA record${
      items.length === 1 ? '' : 's'
    }.`
  );

  for (const item of sample) {
    if (kind === 'recall') {
      const summary = toSentences(item?.Summary ?? item?.summary ?? '');
      const consequence = toSentences(item?.Consequence ?? item?.consequence ?? '');
      const snippet = [summary, consequence].filter(Boolean).join(' ');
      if (snippet) parts.push(`Example: ${snippet}`);
    } else {
      const summary = toSentences(item?.summary ?? item?.Summary ?? item?.complaint_summary ?? '');
      if (summary) {
        parts.push(`Example: ${summary}`);
      } else {
        const tags = [
          item?.fire ? 'fire reported' : '',
          item?.crash ? 'crash reported' : '',
          item?.numberofinjuries ? `${item.numberofinjuries} injuries` : '',
        ]
          .filter(Boolean)
          .join(', ');
        if (tags) parts.push(`Example: ${tags}.`);
      }
    }
  }

  if (parts.length < 2) {
    parts.push('Signal is based on NHTSA public records and should be validated with VIN-specific checks.');
  }

  return parts.slice(0, 5).join(' ');
}

function isSafetyCritical(component) {
  const lower = component.toLowerCase();
  return SAFETY_CRITICAL_COMPONENT_HINTS.some((hint) => lower.includes(hint));
}

function classifyConsideration(recallCount, complaintCount) {
  if (recallCount > 0) {
    return {
      type: 'watch_out',
      priority: 'high',
      driver: 'recall-driven',
    };
  }
  if (complaintCount >= 200) {
    return {
      type: 'watch_out',
      priority: 'high',
      driver: 'complaint-driven',
    };
  }
  if (complaintCount >= 50) {
    return {
      type: 'watch_out',
      priority: 'medium',
      driver: 'complaint-driven',
    };
  }
  return {
    type: 'maintenance',
    priority: 'low',
    driver: 'complaint-driven',
  };
}

function buildIssueBuckets(recallsResults, complaintsResults, { forDisplay = false } = {}) {
  const bucketMap = new Map();

  for (const recallGroup of groupRecalls(recallsResults, { forDisplay })) {
    bucketMap.set(`recall::${recallGroup.familyKey}`, recallGroup);
  }

  for (const cluster of clusterComplaints(complaintsResults, { forDisplay })) {
    bucketMap.set(`complaint::${cluster.clusterKey}`, cluster);
  }

  const buckets = [...bucketMap.values()].sort((a, b) => b.items.length - a.items.length);
  return forDisplay ? buckets.slice(0, MAX_ISSUES_PER_VEHICLE_YEAR) : buckets;
}

async function upsertMake(makeName) {
  const normalizedMakeName = normalizeMakeForDb(makeName);

  const { data: existing, error: readError } = await supabase
    .from('makes')
    .select('id')
    .ilike('name', normalizedMakeName)
    .limit(1);

  if (readError) throw new Error(`Read make failed (${normalizedMakeName}): ${readError.message}`);
  if (existing && existing.length > 0) return existing[0].id;

  const { data, error } = await supabase
    .from('makes')
    .upsert([{ name: normalizedMakeName }], { onConflict: 'name' })
    .select('id')
    .single();

  if (error) throw new Error(`Upsert make failed (${normalizedMakeName}): ${error.message}`);
  return data.id;
}

async function upsertModel(makeId, modelName) {
  const normalizedModelName = normalizeModelForDb(modelName);

  const { data: existing, error: readError } = await supabase
    .from('models')
    .select('id')
    .eq('make_id', makeId)
    .ilike('name', normalizedModelName)
    .limit(1);

  if (readError) {
    throw new Error(`Read model failed (${makeId}/${normalizedModelName}): ${readError.message}`);
  }
  if (existing && existing.length > 0) return existing[0].id;

  const { data, error } = await supabase
    .from('models')
    .upsert([{ make_id: makeId, name: normalizedModelName }], { onConflict: 'make_id,name' })
    .select('id')
    .single();

  if (error) throw new Error(`Upsert model failed (${makeId}/${normalizedModelName}): ${error.message}`);
  return data.id;
}

async function upsertVehicleYear(modelId, year) {
  const { data, error } = await supabase
    .from('vehicle_years')
    .upsert([{ model_id: modelId, year }], { onConflict: 'model_id,year' })
    .select('id')
    .single();

  if (error) throw new Error(`Upsert vehicle_year failed (${modelId}/${year}): ${error.message}`);
  return data.id;
}

async function recalculateVehicleScores(vehicleYearId) {
  const { error } = await supabase.rpc('calculate_vehicle_score', {
    p_vehicle_year_id: vehicleYearId,
  });

  if (error) {
    console.error(`Score recalculation failed for vehicle_year_id ${vehicleYearId}: ${error.message}`);
    return false;
  }

  console.log(`Scores recalculated for vehicle_year_id ${vehicleYearId}`);
  return true;
}

async function rebuildVehicleScores(vehicleYearId) {
  const { error } = await supabase.rpc('rebuild_vehicle_scores', {
    p_vehicle_year_id: vehicleYearId,
  });

  if (error) {
    console.error(`Vehicle scores rebuild failed for vehicle_year_id ${vehicleYearId}: ${error.message}`);
    return false;
  }

  console.log(`Vehicle scores rebuilt for vehicle_year_id ${vehicleYearId}`);
  return true;
}

async function upsertNhtsaConsideration(vehicleYearId, recallCount, complaintCount) {
  const classification = classifyConsideration(recallCount, complaintCount);
  const description = `NHTSA signals: ${recallCount} recalls, ${complaintCount} complaints (raw counts). ${classification.driver}.`;

  const { data: existing, error: readError } = await supabase
    .from('vehicle_considerations')
    .select('id')
    .eq('vehicle_year_id', vehicleYearId)
    .eq('type', classification.type)
    .eq('priority', classification.priority)
    .like('description', 'NHTSA signals:%')
    .limit(1);

  if (readError) {
    throw new Error(`Read vehicle_considerations failed (${vehicleYearId}): ${readError.message}`);
  }

  if (existing && existing.length > 0) return false;

  const { error: insertError } = await supabase.from('vehicle_considerations').insert([
    {
      vehicle_year_id: vehicleYearId,
      type: classification.type,
      priority: classification.priority,
      description,
    },
  ]);

  if (insertError) {
    throw new Error(`Insert vehicle_considerations failed (${vehicleYearId}): ${insertError.message}`);
  }

  return true;
}

async function deleteExistingNhtsaRepairIssues(vehicleYearId) {
  const { error } = await supabase
    .from('repair_issues')
    .delete()
    .eq('vehicle_year_id', vehicleYearId)
    .eq('source_name', 'nhtsa');

  if (error) {
    throw new Error(`Delete repair_issues failed (${vehicleYearId}/nhtsa): ${error.message}`);
  }
}

function buildRepairIssueRow(vehicleYearId, bucket) {
  const bucketCount = bucket.items.length;
  let issueName;
  let description;
  let severity = 'low';
  let isSystemic = false;

  if (bucket.kind === 'complaint') {
    const mapped = mapComplaintClusterToIssue(bucket);
    if (!mapped) return null;
    issueName = mapped.issueName;
    description = mapped.description;
    severity = mapped.severity;
    isSystemic = mapped.isSystemic;
  } else {
    issueName = bucket.issueName;
    description = summarizeBucket(bucket.kind, bucket.component, bucket.items);
    severity = classifyRecallSeverity(bucket);
    isSystemic = isSystemicRecallGroup(bucket);
  }

  const mileageValues =
    bucket.kind === 'complaint' ? bucket.items.map(getComplaintMileage).filter((v) => v !== null) : [];
  const narrativeMileageValues =
    bucket.kind === 'complaint'
      ? bucket.items.flatMap((item) => extractMileage(getComplaintNarrative(item)))
      : [];
  const typicalMileage = median([...mileageValues, ...narrativeMileageValues]);
  const costValues =
    bucket.kind === 'complaint'
      ? bucket.items.flatMap((item) => extractRepairCosts(getComplaintNarrative(item)))
      : [];
  const costMin = costValues.length ? Math.min(...costValues) : null;
  const costMax = costValues.length ? Math.max(...costValues) : null;

  return {
    vehicle_year_id: vehicleYearId,
    issue_name: issueName,
    source_name: 'nhtsa',
    severity,
    typical_mileage: typicalMileage,
    complaint_count: bucket.kind === 'complaint' ? bucketCount : 0,
    recall_count: bucket.kind === 'recall' ? bucketCount : 0,
    cost_min: costMin,
    cost_max: costMax,
    failure_rate_estimate: null,
    description,
    is_systemic: isSystemic,
  };
}

async function insertRepairIssues(vehicleYearId, recallsResults, complaintsResults) {
  const buckets = buildIssueBuckets(recallsResults, complaintsResults, { forDisplay: false });
  await deleteExistingNhtsaRepairIssues(vehicleYearId);
  let upserted = 0;
  let skippedProtected = 0;

  for (const bucket of buckets) {
    const row = buildRepairIssueRow(vehicleYearId, bucket);
    if (!row) continue;

    if (row.issue_name.toLowerCase().includes('general')) {
      console.log('[debug-general-row-before-upsert]', {
        vehicleYearId,
        issueName: row.issue_name,
        severity: row.severity,
        complaintCount: row.complaint_count,
        recallCount: row.recall_count,
        sourceName: row.source_name,
        bucketKind: bucket.kind,
        bucketComponent: bucket.component,
        bucketSymptom: bucket.symptom,
        bucketClusterKey: bucket.clusterKey,
      });
    }

    const { data: existing, error: readError } = await supabase
      .from('repair_issues')
      .select('id,typical_mileage,cost_min,cost_max,failure_rate_estimate')
      .eq('vehicle_year_id', vehicleYearId)
      .eq('issue_name', row.issue_name)
      .eq('source_name', 'nhtsa')
      .limit(1);

    if (readError) {
      throw new Error(`Read repair_issues failed (${vehicleYearId}/${row.issue_name}): ${readError.message}`);
    }

    const existingRow = existing && existing.length > 0 ? existing[0] : null;
    if (existingRow) {
      if (row.typical_mileage === null && existingRow.typical_mileage !== null) {
        row.typical_mileage = existingRow.typical_mileage;
      }
      if (row.cost_min === null && existingRow.cost_min !== null) {
        row.cost_min = existingRow.cost_min;
      }
      if (row.cost_max === null && existingRow.cost_max !== null) {
        row.cost_max = existingRow.cost_max;
      }
    }

    const hasCuratedFields =
      existingRow &&
      (existingRow.cost_min !== null ||
        existingRow.cost_max !== null ||
        existingRow.failure_rate_estimate !== null);

    if (hasCuratedFields) {
      skippedProtected += 1;
      continue;
    }

    const { error: upsertError } = await supabase
      .from('repair_issues')
      .upsert([row], { onConflict: 'vehicle_year_id,issue_name,source_name' });
    if (upsertError) {
      throw new Error(
        `Upsert repair_issues failed (${vehicleYearId}/${row.issue_name}): ${upsertError.message}`
      );
    }
    upserted += 1;
  }

  return { upserted, skippedProtected };
}

function addDays(date, days) {
  const out = new Date(date);
  out.setDate(out.getDate() + days);
  return out;
}

function nextIngestDays(totalRecalls, totalComplaints) {
  if (totalComplaints >= 200 || totalRecalls >= 3) return 7;
  if (totalComplaints >= 25) return 30;
  return 90;
}

function firstRow(value) {
  return Array.isArray(value) ? value[0] : value;
}

async function getIngestAttempts(vehicleYearId) {
  const { data, error } = await supabase
    .from('vehicle_years')
    .select('ingest_attempts')
    .eq('id', vehicleYearId)
    .single();

  if (error) {
    throw new Error(`Read ingest_attempts failed (${vehicleYearId}): ${error.message}`);
  }

  return Number(data?.ingest_attempts ?? 0);
}

async function updateVehicleYearIngestionSuccess(vehicleYearId, totalComplaints, totalRecalls) {
  const now = new Date();
  const attempts = await getIngestAttempts(vehicleYearId);
  const nextAt = addDays(now, nextIngestDays(totalRecalls, totalComplaints)).toISOString();

  const { error } = await supabase
    .from('vehicle_years')
    .update({
      total_complaints: totalComplaints,
      total_recalls: totalRecalls,
      last_ingested_at: now.toISOString(),
      ingestion_status: 'complete',
      ingest_attempts: attempts + 1,
      next_ingest_at: nextAt,
    })
    .eq('id', vehicleYearId);

  if (error) {
    throw new Error(`Update ingestion success failed (${vehicleYearId}): ${error.message}`);
  }

  console.log(
    `vehicle_year_id ${vehicleYearId} ingestion_status=complete totals(recalls=${totalRecalls}, complaints=${totalComplaints}) next_ingest_at=${nextAt}`
  );
}

async function updateVehicleYearIngestionFailure(vehicleYearId) {
  const now = new Date();
  const attempts = await getIngestAttempts(vehicleYearId);
  const nextAt = addDays(now, 3).toISOString();

  const { error } = await supabase
    .from('vehicle_years')
    .update({
      ingestion_status: 'error',
      ingest_attempts: attempts + 1,
      next_ingest_at: nextAt,
    })
    .eq('id', vehicleYearId);

  if (error) {
    throw new Error(`Update ingestion failure failed (${vehicleYearId}): ${error.message}`);
  }

  console.log(`vehicle_year_id ${vehicleYearId} ingestion_status=error next_ingest_at=${nextAt}`);
}

async function fetchDueVehicleYears(limit) {
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from('vehicle_years')
    .select(
      `
      id,
      year,
      next_ingest_at,
      models!inner (
        name,
        makes!inner ( name )
      )
    `
    )
    .or(`next_ingest_at.is.null,next_ingest_at.lte.${nowIso}`)
    .order('next_ingest_at', { ascending: true })
    .limit(limit);

  if (error) {
    throw new Error(`Fetch due vehicle_years failed: ${error.message}`);
  }

  return (data ?? [])
    .map((row) => {
      const modelRow = firstRow(row.models);
      const makeRow = firstRow(modelRow?.makes);
      return {
        vehicleYearId: row.id,
        year: row.year,
        makeName: makeRow?.name ?? null,
        modelName: modelRow?.name ?? null,
      };
    })
    .filter((row) => row.vehicleYearId && row.makeName && row.modelName && row.year);
}

async function runSingleVehicleMode() {
  const startedAt = Date.now();
  const years = yearsRange(START_YEAR, END_YEAR);
  let scannedPairs = 0;
  let scannedYearIterations = 0;
  let qualifyingYears = 0;
  let insertedConsiderations = 0;
  let insertedRepairIssues = 0;
  let skippedProtectedRepairIssues = 0;

  if (TEST_SCOPE.ENABLED) {
    const scopedVehicles = TEST_SCOPE.VEHICLES.map(({ MAKE, MODEL, YEAR }) => ({
      makeName: normalizeVehicleToken(MAKE),
      modelName: normalizeVehicleToken(MODEL),
      year: Number(YEAR),
    })).filter(
      ({ makeName, modelName, year }) => makeName && modelName && Number.isInteger(year)
    );
    const uniqueScopedVehicles = scopedVehicles.filter(
      ({ makeName, modelName, year }, idx, arr) =>
        arr.findIndex(
          (vehicle) =>
            vehicle.makeName.toUpperCase() === makeName.toUpperCase() &&
            vehicle.modelName.toUpperCase() === modelName.toUpperCase() &&
            vehicle.year === year
        ) === idx
    );

    console.log(`Test scope enabled -> ${uniqueScopedVehicles.length} vehicles`);

    for (let vehicleIndex = 0; vehicleIndex < uniqueScopedVehicles.length; vehicleIndex += 1) {
      const { makeName, modelName, year } = uniqueScopedVehicles[vehicleIndex];
      scannedPairs += 1;
      scannedYearIterations += 1;

      console.log(`\n[TEST] ${makeName} ${modelName} ${year}`);

      if (scannedYearIterations % PROGRESS_EVERY === 0) {
        console.log(`[progress] scanned_year_checks=${scannedYearIterations} failed_requests=${failedRequests}`);
      }

      let vehicleYearId = null;

      try {
        const recalls = await safeGetJson(RECALLS_URL(makeName, modelName, year));
        const complaints = await safeGetJson(COMPLAINTS_URL(makeName, modelName, year));

        const recallsResults = extractResults(recalls);
        const complaintsResults = extractResults(complaints);
        const recallCount = recallsResults.length;
        const complaintCount = complaintsResults.length;

        if (recallCount <= 0 && complaintCount <= 0) continue;
        qualifyingYears += 1;

        const dbMakeId = await upsertMake(makeName);
        const dbModelId = await upsertModel(dbMakeId, modelName);
        vehicleYearId = await upsertVehicleYear(dbModelId, year);

        const insertedConsideration = await upsertNhtsaConsideration(vehicleYearId, recallCount, complaintCount);
        if (insertedConsideration) insertedConsiderations += 1;

        const issuesResult = await insertRepairIssues(vehicleYearId, recallsResults, complaintsResults);
        insertedRepairIssues += issuesResult.upserted;
        skippedProtectedRepairIssues += issuesResult.skippedProtected;

        const rebuiltVehicleScores = await rebuildVehicleScores(vehicleYearId);
        if (rebuiltVehicleScores) {
          await recalculateVehicleScores(vehicleYearId);
        }
        await updateVehicleYearIngestionSuccess(vehicleYearId, complaintCount, recallCount);

        console.log(
          `    year ${year}: recalls=${recallCount}, complaints=${complaintCount} -> consideration ${
            insertedConsideration ? 'inserted' : 'skipped'
          }, totals_written(recalls=${recallCount}, complaints=${complaintCount}), repair_issues upserted=${issuesResult.upserted} skipped_protected=${issuesResult.skippedProtected}`
        );
      } catch (dbErr) {
        if (vehicleYearId) {
          try {
            await updateVehicleYearIngestionFailure(vehicleYearId);
          } catch (statusErr) {
            console.error(`    year ${year}: failed to set ingestion error status`, statusErr?.message ?? statusErr);
          }
        }
        console.error(`    year ${year}: DB write failed for ${makeName} ${modelName}`, dbErr?.message ?? dbErr);
      }
    }

    const elapsedSec = ((Date.now() - startedAt) / 1000).toFixed(1);
    console.log('\nIngestion complete.');
    console.log(`Scanned make/model pairs: ${scannedPairs}`);
    console.log(`Qualifying vehicle years: ${qualifyingYears}`);
    console.log(`Inserted vehicle_considerations rows: ${insertedConsiderations}`);
    console.log(`Inserted repair_issues rows: ${insertedRepairIssues}`);
    console.log(`Skipped protected repair_issues rows: ${skippedProtectedRepairIssues}`);
    console.log(`Failed requests: ${failedRequests}`);
    console.log(`Elapsed: ${elapsedSec}s`);
    return;
  }

  const scopedMakes = TARGET_MAKES;
  console.log(`Using makes: ${scopedMakes.join(', ')}`);

  for (let makeIndex = 0; makeIndex < scopedMakes.length; makeIndex += 1) {
    const rawMake = scopedMakes[makeIndex];
    const makeName = normalizeVehicleToken(rawMake);
    console.log(`\n[${makeIndex + 1}/${scopedMakes.length}] Make ${makeName}`);

    const modelsPayload = await safeGetJson(VPIC_MODELS_BY_MAKE_URL(makeName));
    const allModels = modelsPayload?.Results ?? modelsPayload?.results ?? [];
    const models = allModels
      .map((model) => normalizeVehicleToken(model.Model_Name ?? model.model_name))
      .filter(Boolean)
      .filter((name, idx, arr) => arr.indexOf(name) === idx)
      .slice(0, MAX_MODELS_PER_MAKE);
    console.log(`Found ${models.length} models for ${makeName} (limited to ${MAX_MODELS_PER_MAKE}).`);

    for (let modelIndex = 0; modelIndex < models.length; modelIndex += 1) {
      const modelName = models[modelIndex];
      scannedPairs += 1;
      console.log(`  - Model ${modelIndex + 1}/${models.length}: ${modelName}`);

      for (const year of years) {
        scannedYearIterations += 1;
        if (scannedYearIterations % PROGRESS_EVERY === 0) {
          console.log(`[progress] scanned_year_checks=${scannedYearIterations} failed_requests=${failedRequests}`);
        }

        let vehicleYearId = null;

        try {
          const recalls = await safeGetJson(RECALLS_URL(makeName, modelName, year));
          const complaints = await safeGetJson(COMPLAINTS_URL(makeName, modelName, year));

          const recallsResults = extractResults(recalls);
          const complaintsResults = extractResults(complaints);
          const recallCount = recallsResults.length;
          const complaintCount = complaintsResults.length;

          if (recallCount <= 0 && complaintCount <= 0) continue;
          qualifyingYears += 1;

          const dbMakeId = await upsertMake(makeName);
          const dbModelId = await upsertModel(dbMakeId, modelName);
          vehicleYearId = await upsertVehicleYear(dbModelId, year);

          const insertedConsideration = await upsertNhtsaConsideration(vehicleYearId, recallCount, complaintCount);
          if (insertedConsideration) insertedConsiderations += 1;

          const issuesResult = await insertRepairIssues(vehicleYearId, recallsResults, complaintsResults);
          insertedRepairIssues += issuesResult.upserted;
          skippedProtectedRepairIssues += issuesResult.skippedProtected;

          const rebuiltVehicleScores = await rebuildVehicleScores(vehicleYearId);
          if (rebuiltVehicleScores) {
            await recalculateVehicleScores(vehicleYearId);
          }
          await updateVehicleYearIngestionSuccess(vehicleYearId, complaintCount, recallCount);

          console.log(
            `    year ${year}: recalls=${recallCount}, complaints=${complaintCount} -> consideration ${
              insertedConsideration ? 'inserted' : 'skipped'
            }, totals_written(recalls=${recallCount}, complaints=${complaintCount}), repair_issues upserted=${issuesResult.upserted} skipped_protected=${issuesResult.skippedProtected}`
          );
        } catch (dbErr) {
          if (vehicleYearId) {
            try {
              await updateVehicleYearIngestionFailure(vehicleYearId);
            } catch (statusErr) {
              console.error(`    year ${year}: failed to set ingestion error status`, statusErr?.message ?? statusErr);
            }
          }
          console.error(`    year ${year}: DB write failed for ${makeName} ${modelName}`, dbErr?.message ?? dbErr);
        }
      }
    }
  }

  const elapsedSec = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log('\nIngestion complete.');
  console.log(`Scanned make/model pairs: ${scannedPairs}`);
  console.log(`Qualifying vehicle years: ${qualifyingYears}`);
  console.log(`Inserted vehicle_considerations rows: ${insertedConsiderations}`);
  console.log(`Inserted repair_issues rows: ${insertedRepairIssues}`);
  console.log(`Skipped protected repair_issues rows: ${skippedProtectedRepairIssues}`);
  console.log(`Failed requests: ${failedRequests}`);
  console.log(`Elapsed: ${elapsedSec}s`);
}

async function runQueuedBatchMode() {
  const startedAt = Date.now();
  console.log(`Queued batch mode: selecting up to ${MAX_VEHICLE_YEARS_PER_RUN} due vehicle years...`);

  const dueRows = await fetchDueVehicleYears(MAX_VEHICLE_YEARS_PER_RUN);
  console.log(`Due vehicle_year rows loaded: ${dueRows.length}`);

  let processed = 0;
  let completed = 0;
  let errored = 0;

  for (const row of dueRows) {
    processed += 1;
    const { vehicleYearId, makeName, modelName, year } = row;
    console.log(`\n[${processed}/${dueRows.length}] vehicle_year_id=${vehicleYearId} ${makeName} ${modelName} ${year}`);

    try {
      const recalls = await safeGetJson(RECALLS_URL(makeName, modelName, year));
      const complaints = await safeGetJson(COMPLAINTS_URL(makeName, modelName, year));

      const recallsResults = extractResults(recalls);
      const complaintsResults = extractResults(complaints);
      const recallCount = recallsResults.length;
      const complaintCount = complaintsResults.length;

      const insertedConsideration =
        recallCount > 0 || complaintCount > 0
          ? await upsertNhtsaConsideration(vehicleYearId, recallCount, complaintCount)
          : false;

      const issuesResult = await insertRepairIssues(vehicleYearId, recallsResults, complaintsResults);
      const rebuiltVehicleScores = await rebuildVehicleScores(vehicleYearId);
      if (rebuiltVehicleScores) {
        await recalculateVehicleScores(vehicleYearId);
      }
      await updateVehicleYearIngestionSuccess(vehicleYearId, complaintCount, recallCount);

      completed += 1;
      console.log(
        `    totals_written(recalls=${recallCount}, complaints=${complaintCount}) consideration=${
          insertedConsideration ? 'inserted' : 'skipped'
        } repair_issues upserted=${issuesResult.upserted} skipped_protected=${issuesResult.skippedProtected}`
      );
    } catch (err) {
      errored += 1;
      try {
        await updateVehicleYearIngestionFailure(vehicleYearId);
      } catch (statusErr) {
        console.error(`    failed to set ingestion error status for vehicle_year_id ${vehicleYearId}`, statusErr);
      }
      console.error(`    queued ingest failed for vehicle_year_id ${vehicleYearId}: ${err?.message ?? String(err)}`);
    }
  }

  const elapsedSec = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log('\nQueued batch ingestion complete.');
  console.log(`Processed: ${processed}`);
  console.log(`Completed: ${completed}`);
  console.log(`Errored: ${errored}`);
  console.log(`Failed requests: ${failedRequests}`);
  console.log(`Elapsed: ${elapsedSec}s`);
}

async function main() {
  if (MODE === 'queued_batch') {
    await runQueuedBatchMode();
    return;
  }
  await runSingleVehicleMode();
}

main().catch((err) => {
  console.error('Fatal ingestion error', err?.message ?? err);
  process.exit(1);
});
