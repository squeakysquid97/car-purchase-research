import { createClient } from '@supabase/supabase-js';

// Curated list of popular makes for better signal coverage.
const TARGET_MAKES = [
  'TOYOTA',
  // 'HONDA',
  // 'FORD',
  // 'CHEVROLET',
  // 'NISSAN',
  // 'JEEP',
  // 'HYUNDAI',
  // 'KIA',
  // 'SUBARU',
  // 'BMW',
];

// Temporary test scope toggle. Set ENABLED=false to revert to full run.
const TEST_SCOPE = {
  ENABLED: false,
  MAKE: 'TOYOTA',
  MODEL: 'COROLLA',
  YEAR: 2008,
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
const START_YEAR = 2018;
const END_YEAR = 2024;
const REQUEST_DELAY_MS = 200;
const PROGRESS_EVERY = 100;
const MAX_ISSUES_PER_VEHICLE_YEAR = 10;

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

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid];
  return Math.round((sorted[mid - 1] + sorted[mid]) / 2);
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

function buildIssueBuckets(recallsResults, complaintsResults) {
  const bucketMap = new Map();

  for (const recall of recallsResults) {
    const component = canonicalizeComponent(getComponentFromRecall(recall));
    const key = `recall::${component}`;
    const existing = bucketMap.get(key) ?? { kind: 'recall', component, items: [] };
    existing.items.push(recall);
    bucketMap.set(key, existing);
  }

  for (const complaint of complaintsResults) {
    const component = canonicalizeComponent(getComponentFromComplaint(complaint));
    const key = `complaint::${component}`;
    const existing = bucketMap.get(key) ?? { kind: 'complaint', component, items: [] };
    existing.items.push(complaint);
    bucketMap.set(key, existing);
  }

  return [...bucketMap.values()]
    .sort((a, b) => b.items.length - a.items.length)
    .slice(0, MAX_ISSUES_PER_VEHICLE_YEAR);
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

function buildRepairIssueRow(vehicleYearId, bucket) {
  const bucketCount = bucket.items.length;
  const issuePrefix = bucket.kind === 'recall' ? 'Recall' : 'Complaints';
  const keywords = topKeywordsForBucket(bucket);
  const keywordSuffix = bucket.kind === 'complaint' && keywords.length > 0 ? ` - ${keywords[0]}` : '';
  const issueName = `${issuePrefix}: ${bucket.component}${keywordSuffix} (NHTSA)`;
  const description = summarizeBucket(bucket.kind, bucket.component, bucket.items);

  let severity = 'low';
  if (bucket.kind === 'recall' && isSafetyCritical(bucket.component)) severity = 'catastrophic';
  else if (bucket.kind === 'recall') severity = 'high';
  else if (bucketCount >= 50) severity = 'medium';

  const mileageValues =
    bucket.kind === 'complaint' ? bucket.items.map(getComplaintMileage).filter((v) => v !== null) : [];
  const typicalMileage = mileageValues.length ? median(mileageValues) : null;

  return {
    vehicle_year_id: vehicleYearId,
    issue_name: issueName,
    severity,
    typical_mileage: typicalMileage,
    complaint_count: bucket.kind === 'complaint' ? bucketCount : 0,
    recall_count: bucket.kind === 'recall' ? bucketCount : 0,
    cost_min: null,
    cost_max: null,
    failure_rate_estimate: null,
    description,
    is_systemic: bucket.kind === 'recall' || bucketCount >= 100,
  };
}

async function insertRepairIssues(vehicleYearId, recallsResults, complaintsResults) {
  const buckets = buildIssueBuckets(recallsResults, complaintsResults);
  let upserted = 0;
  let skippedProtected = 0;

  for (const bucket of buckets) {
    const row = buildRepairIssueRow(vehicleYearId, bucket);

    const { data: existing, error: readError } = await supabase
      .from('repair_issues')
      .select('id,cost_min,cost_max,failure_rate_estimate')
      .eq('vehicle_year_id', vehicleYearId)
      .eq('issue_name', row.issue_name)
      .limit(1);

    if (readError) {
      throw new Error(`Read repair_issues failed (${vehicleYearId}/${row.issue_name}): ${readError.message}`);
    }

    const existingRow = existing && existing.length > 0 ? existing[0] : null;
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
      .upsert([row], { onConflict: 'vehicle_year_id,issue_name' });
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
  const scopedMakes = TEST_SCOPE.ENABLED ? [TEST_SCOPE.MAKE] : TARGET_MAKES;
  const years = TEST_SCOPE.ENABLED ? [TEST_SCOPE.YEAR] : yearsRange(START_YEAR, END_YEAR);

  console.log(`Using makes: ${scopedMakes.join(', ')}`);
  if (TEST_SCOPE.ENABLED) {
    console.log(
      `Test scope enabled -> make=${TEST_SCOPE.MAKE}, model=${TEST_SCOPE.MODEL}, year=${TEST_SCOPE.YEAR}`
    );
  }

  let scannedPairs = 0;
  let scannedYearIterations = 0;
  let qualifyingYears = 0;
  let insertedConsiderations = 0;
  let insertedRepairIssues = 0;
  let skippedProtectedRepairIssues = 0;

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
      .filter((name) => {
        if (!TEST_SCOPE.ENABLED) return true;
        return name.toUpperCase() === TEST_SCOPE.MODEL;
      })
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

          await recalculateVehicleScores(vehicleYearId);
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
      await recalculateVehicleScores(vehicleYearId);
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
