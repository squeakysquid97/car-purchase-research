import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing required env vars: SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

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

function parseMoney(value) {
  const text = String(value ?? '');
  const match = text.match(/\$\s*([\d,]+(?:\.\d+)?)/);
  if (!match) return null;
  const numeric = Number(match[1].replace(/,/g, ''));
  if (!Number.isFinite(numeric)) return null;
  return Math.round(numeric);
}

function parseMileage(value) {
  const text = String(value ?? '');
  const match = text.match(/([\d,]+)\s*(?:miles?|mi\.?)/i);
  if (!match) return null;
  const numeric = Number(match[1].replace(/,/g, ''));
  if (!Number.isFinite(numeric)) return null;
  return Math.round(numeric);
}

function normalizeIssueName(value) {
  return normalizeVehicleToken(value)
    .replace(/\s+/g, ' ')
    .replace(/\s+problems?$/i, '')
    .trim();
}

function stripHtml(value) {
  return String(value ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function parseCostRange(value) {
  const text = String(value ?? '');
  const matches = [...text.matchAll(/\$\s*([\d,]+(?:\.\d+)?)/g)];
  if (matches.length === 0) return { costMin: null, costMax: null };

  const values = matches
    .map((match) => Number(match[1].replace(/,/g, '')))
    .filter((num) => Number.isFinite(num))
    .map((num) => Math.round(num));

  if (values.length === 0) return { costMin: null, costMax: null };
  if (values.length === 1) return { costMin: values[0], costMax: values[0] };
  return {
    costMin: Math.min(...values),
    costMax: Math.max(...values),
  };
}

function buildCarComplaintsUrlCandidates(make, model, year) {
  const makeParts = [normalizeMakeForDb(make), normalizeVehicleToken(make), String(make).toUpperCase()]
    .map((v) => normalizeVehicleToken(v))
    .filter(Boolean);

  const modelParts = [
    normalizeModelForDb(model),
    normalizeModelForDb(model).replace(/\s+/g, '_'),
    normalizeModelForDb(model).replace(/\s+/g, '-'),
  ]
    .map((v) => normalizeVehicleToken(v))
    .filter(Boolean);

  const urls = [];
  for (const makePart of makeParts) {
    for (const modelPart of modelParts) {
      urls.push(
        `https://www.carcomplaints.com/${encodeURIComponent(makePart)}/${encodeURIComponent(modelPart)}/${year}/`
      );
    }
  }

  return [...new Set(urls)];
}

async function fetchPage(url) {
  const res = await fetch(url, {
    headers: {
      Accept: 'text/html,application/xhtml+xml',
      'User-Agent': 'Mozilla/5.0 (compatible; car-reliability-ingest/1.0)',
    },
  });

  if (!res.ok) return null;
  return await res.text();
}

function parseIssueCandidatesFromHtml(html, year) {
  const rows = [];
  const rowRegex = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  for (const match of html.matchAll(rowRegex)) {
    const rowHtml = match[1];
    const cellMatches = [...rowHtml.matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((m) =>
      stripHtml(m[1])
    );

    if (!cellMatches.length) continue;

    const titleCell = cellMatches[0] ?? '';
    if (!titleCell || /^problem\s*$/i.test(titleCell)) continue;

    const issueName = normalizeIssueName(titleCell);
    if (!issueName) continue;

    const rowText = stripHtml(rowHtml);
    const complaintMatch = rowText.match(/([\d,]+)\s+(?:complaints?|problems?)/i);
    const complaintCount = complaintMatch
      ? Number(complaintMatch[1].replace(/,/g, '')) || null
      : null;

    const typicalMileage =
      parseMileage(rowText) ?? parseMileage(cellMatches.find((cell) => /miles?|mi\.?/i.test(cell)) ?? '');

    const costCell = cellMatches.find((cell) => /\$/i.test(cell)) ?? rowText;
    const { costMin, costMax } = parseCostRange(costCell);

    rows.push({
      issue_name: issueName,
      description: rowText || null,
      complaint_count: complaintCount,
      typical_mileage: typicalMileage,
      cost_min: costMin,
      cost_max: costMax,
      source_name: 'carcomplaints',
      _rank: complaintCount ?? 0,
    });
  }

  if (rows.length > 0) return rows;

  const blockRegex = new RegExp(
    `<a[^>]+href=["'][^"']*\\/${year}\\/[^"']+["'][^>]*>([\\s\\S]*?)<\\/a>([\\s\\S]{0,400})`,
    'gi'
  );

  for (const match of html.matchAll(blockRegex)) {
    const rawTitle = stripHtml(match[1]);
    const context = stripHtml(match[2]);
    const issueName = normalizeIssueName(rawTitle);
    if (!issueName) continue;

    const complaintMatch = context.match(/([\d,]+)\s+(?:complaints?|problems?)/i);
    const complaintCount = complaintMatch
      ? Number(complaintMatch[1].replace(/,/g, '')) || null
      : null;

    const typicalMileage = parseMileage(context);
    const { costMin, costMax } = parseCostRange(context);

    rows.push({
      issue_name: issueName,
      description: context || null,
      complaint_count: complaintCount,
      typical_mileage: typicalMileage,
      cost_min: costMin,
      cost_max: costMax,
      source_name: 'carcomplaints',
      _rank: complaintCount ?? 0,
    });
  }

  return rows;
}

function dedupeIssues(rows) {
  const byName = new Map();

  for (const row of rows) {
    if (!row?.issue_name) continue;
    const key = row.issue_name.toLowerCase();
    const existing = byName.get(key);

    if (!existing) {
      byName.set(key, row);
      continue;
    }

    if ((row._rank ?? 0) > (existing._rank ?? 0)) {
      byName.set(key, row);
      continue;
    }

    if (!existing.description && row.description) existing.description = row.description;
    if (existing.complaint_count === null && row.complaint_count !== null) {
      existing.complaint_count = row.complaint_count;
    }
    if (existing.typical_mileage === null && row.typical_mileage !== null) {
      existing.typical_mileage = row.typical_mileage;
    }
    if (existing.cost_min === null && row.cost_min !== null) existing.cost_min = row.cost_min;
    if (existing.cost_max === null && row.cost_max !== null) existing.cost_max = row.cost_max;
  }

  return [...byName.values()].map(({ _rank, ...row }) => row);
}

async function locateAndExtractIssues(make, model, year) {
  const candidates = buildCarComplaintsUrlCandidates(make, model, year);

  for (const url of candidates) {
    try {
      const html = await fetchPage(url);
      if (!html) continue;

      const parsed = dedupeIssues(parseIssueCandidatesFromHtml(html, year));
      if (parsed.length > 0) {
        return {
          url,
          issues: parsed,
        };
      }
    } catch (err) {
      console.warn(`[carcomplaints] failed to fetch/parse ${url}: ${err?.message ?? String(err)}`);
    }
  }

  return {
    url: null,
    issues: [],
  };
}

async function findVehicleYear(make, model, year) {
  const normalizedMake = normalizeMakeForDb(make);
  const normalizedModel = normalizeModelForDb(model);

  const { data, error } = await supabase
    .from('vehicle_years')
    .select(
      `
      id,
      year,
      models!inner (
        id,
        name,
        makes!inner (
          id,
          name
        )
      )
    `
    )
    .eq('year', year)
    .ilike('models.name', normalizedModel)
    .ilike('models.makes.name', normalizedMake)
    .limit(1);

  if (error) {
    throw new Error(`Failed to look up vehicle year ${make} ${model} ${year}: ${error.message}`);
  }

  return data?.[0] ?? null;
}

async function upsertCarComplaintsIssues(vehicleYearId, issues) {
  let written = 0;

  for (const issue of issues) {
    try {
      if (!issue.issue_name) {
        console.warn(`[carcomplaints] skipping malformed issue row: missing issue_name`);
        continue;
      }

      const row = {
        vehicle_year_id: vehicleYearId,
        issue_name: normalizeIssueName(issue.issue_name),
        description: issue.description ? normalizeVehicleToken(issue.description) : null,
        complaint_count: Number.isFinite(issue.complaint_count) ? issue.complaint_count : null,
        typical_mileage: Number.isFinite(issue.typical_mileage) ? issue.typical_mileage : null,
        cost_min: Number.isFinite(issue.cost_min) ? issue.cost_min : parseMoney(issue.cost_min),
        cost_max: Number.isFinite(issue.cost_max) ? issue.cost_max : parseMoney(issue.cost_max),
        source_name: 'carcomplaints',
      };

      if (!row.issue_name) {
        console.warn(`[carcomplaints] skipping malformed issue row after normalization`);
        continue;
      }

      const { data: existing, error: readError } = await supabase
        .from('repair_issues')
        .select('id')
        .eq('vehicle_year_id', vehicleYearId)
        .eq('issue_name', row.issue_name)
        .eq('source_name', 'carcomplaints')
        .limit(1);

      if (readError) {
        console.warn(
          `[carcomplaints] skipping row read failure for "${row.issue_name}": ${readError.message}`
        );
        continue;
      }

      if (existing && existing.length > 0) {
        const { error: updateError } = await supabase
          .from('repair_issues')
          .update({
            description: row.description,
            complaint_count: row.complaint_count,
            typical_mileage: row.typical_mileage,
            cost_min: row.cost_min,
            cost_max: row.cost_max,
          })
          .eq('id', existing[0].id);

        if (updateError) {
          console.warn(
            `[carcomplaints] skipping row update failure for "${row.issue_name}": ${updateError.message}`
          );
          continue;
        }
      } else {
        const { error: insertError } = await supabase.from('repair_issues').insert([row]);

        if (insertError) {
          console.warn(
            `[carcomplaints] skipping row insert failure for "${row.issue_name}": ${insertError.message}`
          );
          continue;
        }
      }

      written += 1;
    } catch (err) {
      console.warn(
        `[carcomplaints] skipping malformed issue row due to error: ${err?.message ?? String(err)}`
      );
    }
  }

  return written;
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

async function calculateVehicleScore(vehicleYearId) {
  const { error } = await supabase.rpc('calculate_vehicle_score', {
    p_vehicle_year_id: vehicleYearId,
  });

  if (error) {
    console.error(`Score recalculation failed for vehicle_year_id ${vehicleYearId}: ${error.message}`);
    return false;
  }

  console.log(`Vehicle score recalculated for vehicle_year_id ${vehicleYearId}`);
  return true;
}

function parseArgs(argv) {
  const [make, model, yearInput] = argv;
  const year = Number(yearInput);

  if (!make || !model || !yearInput || !Number.isInteger(year)) {
    console.error('Usage: node scripts/ingest-carcomplaints.mjs <make> <model> <year>');
    process.exit(1);
  }

  return { make, model, year };
}

async function main() {
  const { make, model, year } = parseArgs(process.argv.slice(2));
  console.log(`[carcomplaints] processing ${make} ${model} ${year}`);

  const vehicleYear = await findVehicleYear(make, model, year);
  if (!vehicleYear?.id) {
    console.error(`[carcomplaints] vehicle_year not found for ${make} ${model} ${year}`);
    process.exit(1);
  }

  const vehicleYearId = vehicleYear.id;
  const extraction = await locateAndExtractIssues(make, model, year);

  if (extraction.url) {
    console.log(`[carcomplaints] source page: ${extraction.url}`);
  } else {
    console.warn(`[carcomplaints] no source page with parseable issues found for ${make} ${model} ${year}`);
  }

  console.log(`[carcomplaints] issues found: ${extraction.issues.length}`);

  const issuesWritten = await upsertCarComplaintsIssues(vehicleYearId, extraction.issues);
  console.log(`[carcomplaints] issues written: ${issuesWritten}`);

  if (issuesWritten > 0) {
    const rebuilt = await rebuildVehicleScores(vehicleYearId);
    if (!rebuilt) {
      console.error('[carcomplaints] score rebuild failed');
      return;
    }

    const recalculated = await calculateVehicleScore(vehicleYearId);
    if (!recalculated) {
      console.error('[carcomplaints] score recalculation failed');
      return;
    }
  } else {
    console.log('[carcomplaints] skipping score rebuild/recalculation because no issues were written');
  }

  console.log('[carcomplaints] ingestion complete');
}

main().catch((err) => {
  console.error('[carcomplaints] fatal ingestion error', err?.message ?? err);
  process.exit(1);
});
