const USER_INFO_PATH = '/gateway/smartatt-core/user/userInfo';
const PERSONAL_RECORD_PATH = '/gateway/smartatt-core/statistics/personList';
const REQUEST_TIMEOUT_MS = 8000;

function attendanceError(message) {
  const error = new Error(message);
  error.code = 'ATTENDANCE_UNAVAILABLE';
  return error;
}

function parseUrl(value) {
  const reportUrl = String(value ?? '').trim();
  if (!reportUrl) throw attendanceError('未配置云之家考勤 URL，已跳过工时计算。');
  try {
    return new URL(reportUrl);
  } catch {
    throw attendanceError('云之家考勤 URL 格式不正确，已跳过工时计算。');
  }
}

function parameterFromUrl(url, name) {
  const direct = url.searchParams.get(name);
  if (direct) return direct;
  const queryIndex = url.hash.indexOf('?');
  if (queryIndex < 0) return '';
  return new URLSearchParams(url.hash.slice(queryIndex + 1)).get(name) ?? '';
}

export function parseAttendanceReportUrl(value, now = Date.now()) {
  const url = parseUrl(value);
  const ticket = parameterFromUrl(url, 'ticket');
  if (!ticket) {
    throw attendanceError('云之家尚未登录或 URL 中没有临时 ticket，已跳过工时计算。');
  }
  const expiresAt = Number(parameterFromUrl(url, 'expire_time'));
  if (Number.isFinite(expiresAt) && expiresAt > 0 && expiresAt <= now) {
    throw attendanceError('云之家登录凭证已过期，请粘贴最新考勤页面 URL。');
  }
  return { origin: url.origin, ticket, expiresAt: expiresAt || null };
}

function requestUrl(origin, path, ticket) {
  const url = new URL(path, origin);
  url.searchParams.set('lappName', 'attendance');
  url.searchParams.set('ticket', ticket);
  return url;
}

function cookieHeader(response) {
  const values = response.headers.getSetCookie?.() ?? [];
  return values.map((value) => value.split(';', 1)[0]).filter(Boolean).join('; ');
}

async function readResponse(response, action) {
  const data = await response.json().catch(() => null);
  if (!response.ok || !data || (!data.success && Number(data.errorCode) !== 200)) {
    throw attendanceError(data?.errorMsg || `${action}失败，请重新登录云之家。`);
  }
  return data;
}

function timeInMinutes(value) {
  const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(String(value ?? '').trim());
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]) + Number(match[3] ?? 0) / 60;
}

export function summarizeAttendanceRecords(records = []) {
  const valid = records
    .filter((record) => record && (record.status === undefined || Number(record.status) === 1))
    .map((record) => ({ ...record, minutes: timeInMinutes(record.clockInTime) }))
    .filter((record) => record.minutes !== null)
    .sort((left, right) => left.minutes - right.minutes);
  if (valid.length < 2) {
    return {
      first: valid[0]?.clockInTime ?? '',
      last: '',
      hours: null,
      recordCount: valid.length
    };
  }
  const first = valid[0];
  const last = valid.at(-1);
  const rawHours = Math.max(0, (last.minutes - first.minutes) / 60);
  return {
    first: first.clockInTime,
    last: last.clockInTime,
    hours: Math.round(rawHours * 2) / 2,
    recordCount: valid.length
  };
}

export function summarizeAttendanceList(list = []) {
  const recordsByDate = new Map();
  for (const row of list.filter(Boolean)) {
    for (const [key, value] of Object.entries(row)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(key) || !Array.isArray(value)) continue;
      recordsByDate.set(key, [...(recordsByDate.get(key) ?? []), ...value]);
    }
  }
  return Object.fromEntries([...recordsByDate.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, records]) => [date, summarizeAttendanceRecords(records)]));
}

export function applyAttendanceHours(preview, attendance) {
  const result = structuredClone(preview);
  result.attendance = {
    source: 'yunzhijia',
    fetchedAt: attendance.fetchedAt,
    days: attendance.days
  };
  const entriesByDate = new Map();
  for (const entry of result.entries ?? []) {
    if (!entriesByDate.has(entry.date)) entriesByDate.set(entry.date, []);
    entriesByDate.get(entry.date).push(entry);
  }
  for (const [date, entries] of entriesByDate) {
    const hours = attendance.days?.[date]?.hours;
    if (!Number.isFinite(hours) || entries.length === 0) continue;
    const units = Math.max(0, Math.round(hours * 2));
    const baseUnits = Math.floor(units / entries.length);
    const remainder = units % entries.length;
    entries.forEach((entry, index) => {
      entry.hours = (baseUnits + (index < remainder ? 1 : 0)) / 2;
    });
  }
  return result;
}

export async function enrichPreviewWithAttendance(config, period, preview, fetcher = fetchAttendance) {
  try {
    const attendance = await fetcher(config, period);
    const hasCalculatedHours = Object.values(attendance.days).some((day) => Number.isFinite(day.hours));
    return {
      preview: hasCalculatedHours ? applyAttendanceHours(preview, attendance) : preview,
      warning: hasCalculatedHours ? '' : '所选日期没有完整的云之家打卡记录，预览已使用原有耗时。'
    };
  } catch (error) {
    return { preview, warning: error.message || '云之家考勤不可用，预览已使用原有耗时。' };
  }
}

export async function fetchAttendance(config, period, options = {}) {
  const { origin, ticket, expiresAt } = parseAttendanceReportUrl(config.attendance?.reportUrl, options.now);
  const fetchImpl = options.fetchImpl ?? fetch;
  const signal = options.signal ?? AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  try {
    const userResponse = await fetchImpl(requestUrl(origin, USER_INFO_PATH, ticket), {
      headers: { accept: 'application/json' },
      signal
    });
    const userResult = await readResponse(userResponse, '获取云之家用户信息');
    const longNumber = userResult.data?.longNumber;
    if (!longNumber) throw attendanceError('云之家没有返回当前用户信息，已跳过工时计算。');

    const cookies = cookieHeader(userResponse);
    const recordResponse = await fetchImpl(requestUrl(origin, PERSONAL_RECORD_PATH, ticket), {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        ...(cookies ? { cookie: cookies } : {})
      },
      body: JSON.stringify({
        statisticsId: '',
        groupIds: [],
        id: '',
        page: 1,
        limit: 31,
        pageType: 'FIRST',
        startDay: period.startDate,
        endDay: period.endDate,
        longNumbers: [longNumber],
        statisticsType: 3,
        prefixType: 1,
        dayStatistics: false,
        resultType: 0,
        dailyResultType: 0
      }),
      signal
    });
    const recordResult = await readResponse(recordResponse, '获取云之家打卡记录');
    return {
      fetchedAt: new Date(options.now ?? Date.now()).toISOString(),
      expiresAt,
      days: summarizeAttendanceList(recordResult.data?.list ?? [])
    };
  } catch (error) {
    if (error.code === 'ATTENDANCE_UNAVAILABLE') throw error;
    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
      throw attendanceError('云之家考勤请求超时，已跳过工时计算。');
    }
    throw attendanceError(`云之家考勤不可用：${error.message || '未知错误'}。已跳过工时计算。`);
  }
}
