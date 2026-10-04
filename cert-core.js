/* cert-core.js — shared by certificate.html, hiring-portal.html and hiring-admin.html
   Certificate data + duration rules. Single source of truth. */
export const SGP = {
  org: 'Study Grid Prep',
  tagline: 'Smart Study Platform',
  publicBase: 'https://studygridprep.online/',
  signatory: { name: 'Ayush Kumar Gupta', title: 'Founder, Study Grid Prep' },
  minDays: 15,                                                              // below this → no certificate
};

export const EMP_LABELS = {
  FULL_TIME: 'Full-time',
  PART_TIME: 'Part-time',
  INTERN: 'Internship',
  CONTRACTOR: 'Contract / Freelance',
  VOLUNTEER: 'Volunteer',
  OTHER: 'Flexible'
};

export function toMs(v){
  if (!v) return null;
  if (v.toDate) return v.toDate().getTime();
  if (v instanceof Date) return v.getTime();
  if (typeof v.seconds === 'number') return v.seconds * 1000;
  const d = new Date(v); return isNaN(d.getTime()) ? null : d.getTime();
}

const addM = (ms, n) => {
  const d = new Date(ms);
  d.setMonth(d.getMonth() + n);
  return d.getTime();
};

/* Accurate duration calculation */
export function certDuration(startMs, endMs){
  const s = new Date(startMs), e = new Date(endMs);
  let m = (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth());
  let anchor = addM(startMs, m);
  if (anchor > endMs) { m--; anchor = addM(startMs, m); }
  const rem = Math.floor((endMs - anchor) / 864e5);
  const monthDays = Math.round((addM(anchor, 1) - anchor) / 864e5);
  let months = m;
  if (monthDays - rem <= 2) months = m + 1;
  else if (rem >= 15) months = m + 0.5;
  const days = Math.max(0, Math.floor((endMs - startMs) / 864e5));
  return { months, days, eligible: days >= SGP.minDays && (months >= 0.5 || days >= 15) };
}

export function fmtMonths(m, days){
  if (m == null && days != null) return `${days} Day${days === 1 ? '' : 's'}`;
  if (m == null || isNaN(m)) return '';
  if (m === 0 && days) return `${days} Day${days === 1 ? '' : 's'}`;
  if (m < 1 && days && days < 28) return `${days} Day${days === 1 ? '' : 's'}`;
  return `${m} Month${m === 1 ? '' : 's'}`;
}

export function certCode(id){
  return 'SGP-' + String(id || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 10).toUpperCase();
}

export function verifyUrl(id){
  const base = (typeof window !== 'undefined' && window.location && window.location.origin)
    ? (window.location.origin + window.location.pathname.replace(/\/[^/]*$/, '/'))
    : SGP.publicBase;
  return base + 'certificate.html?v=' + encodeURIComponent(id);
}

export function certTitle(kind){
  if (kind === 'INTERN') return 'Certificate of Internship';
  if (kind === 'ACHIEVEMENT') return 'Certificate of Achievement';
  if (kind === 'POSITION' || kind === 'ROLE') return 'Certificate of Position & Appointment';
  return 'Experience Certificate';
}

/* Dedicated Position / Role Certificate builder */
export function buildPositionCert(app, role, now = Date.now()){
  const pos = (app && (
    app.positionCert || 
    (app.certOverride && app.certOverride.positionCert) ||
    (app.certOverride && (app.certOverride.kind === 'POSITION' || app.certOverride.kind === 'ROLE') ? app.certOverride : null)
  )) || null;
  if (!pos) return null; // Only available if explicitly given by Admin!
  const o = (app && app.offer) || {};
  const start = toMs(pos.startMs || pos.startDate || (app && app.offerAcceptedAt)) || now;
  const isCurrent = pos.isCurrent !== false && (pos.isCurrent === true || (!pos.endDate && !pos.endMs));
  const end = isCurrent ? null : (toMs(pos.endMs || pos.endDate) || now);
  const issueDate = pos.issueDate ? toMs(pos.issueDate) : (toMs(pos.issuedAt) || now);
  const certName = (pos.name || app.certName || app.name || '').trim();
  const roleTitle = (pos.roleTitle || pos.positionTitle || o.roles || (role && role.title) || 'Team Member').trim();
  
  // Duration or tenure calculation
  let durLabel = pos.durationLabel || '';
  let months = null, days = null;
  if (!isCurrent && end && start) {
    const d = certDuration(start, end);
    months = pos.months != null && pos.months !== '' ? Number(pos.months) : d.months;
    days = d.days;
    if (!durLabel) durLabel = fmtMonths(months, days) || `${days} Days`;
  } else if (isCurrent && start) {
    const d = certDuration(start, now);
    months = d.months;
    days = d.days;
    if (!durLabel) durLabel = `${fmtMonths(months, days)} (Active & Ongoing)`;
  }

  // Detect executive / leadership roles for high-prestige phrasing
  const isExecutive = /(founder|co-founder|director|chief|head|lead|president|vp|vice president|manager|partner|advisor)/i.test(roleTitle);

  return {
    id: (app ? app.id : '') + '-position',
    baseAppId: app ? app.id : '',
    uid: app ? app.uid : '',
    name: certName,
    empType: pos.empType || o.jobType || (role && role.employmentType) || 'FULL_TIME',
    roleTitle,
    department: pos.department || (role && role.department) || 'Core Operations',
    kind: 'POSITION',
    startMs: start,
    endMs: end,
    isCurrent,
    plannedMonths: null,
    plannedEndMs: null,
    days,
    months,
    durationLabel: durLabel || 'Official Appointed Position',
    eligible: true,
    state: 'completed',
    issuedMs: issueDate,
    note: pos.note || '',
    forceIssued: true,
    isPosition: true,
    isExecutive
  };
}

/* Dedicated Achievement Certificate builder */
export function buildAchievementCert(app, role, now = Date.now()){
  const ach = (app && (app.achievementCert || (app.certOverride && app.certOverride.achievementCert))) || null;
  if (!ach) return null; // Only available if explicitly given by Admin!
  const o = (app && app.offer) || {};
  const start = toMs(ach.startMs || ach.startDate || (app && app.offerAcceptedAt)) || now;
  const end = toMs(ach.endMs || ach.endDate) || (ach.issueDate ? toMs(ach.issueDate) : (toMs(ach.issuedAt) || now));
  const issueDate = ach.issueDate ? toMs(ach.issueDate) : (toMs(ach.issuedAt) || now);
  const certName = (ach.name || app.certName || app.name || '').trim();
  const d = certDuration(start, end);
  const months = ach.months != null && ach.months !== '' ? Number(ach.months) : d.months;
  const days = d.days;
  const durLabel = ach.durationLabel || (months != null && months > 0 ? fmtMonths(months, days) : (days > 0 ? `${days} Day${days === 1 ? '' : 's'}` : '1 Month'));

  return {
    id: (app ? app.id : '') + '-achieve',
    baseAppId: app ? app.id : '',
    uid: app ? app.uid : '',
    name: certName,
    empType: o.jobType || (role && role.employmentType) || 'FULL_TIME',
    roleTitle: ach.roleTitle || o.roles || (role && role.title) || 'Outstanding Contributor',
    department: (role && role.department) || '',
    kind: 'ACHIEVEMENT',
    startMs: start,
    endMs: end,
    plannedMonths: null,
    plannedEndMs: null,
    days,
    months,
    durationLabel: durLabel,
    eligible: true,
    state: 'completed',
    issuedMs: issueDate,
    note: ach.note || '',
    forceIssued: true,
    isAchievement: true
  };
}

/* Base Experience / Internship certificate (tied to engagement tenure) */
export function buildCert(app, role, now = Date.now()){
  const o = (app && app.offer) || {}, ov = (app && app.certOverride) || {};
  const empType = o.jobType || (role && role.employmentType) || 'FULL_TIME';
  const intern = empType === 'INTERN';
  const plannedMonths = Number(o.durationMonths) || 6;
  const start = toMs(ov.startMs || ov.startDate || (app && app.offerAcceptedAt));
  const certName = (ov.name || app.certName || app.name || '').trim();

  // Base kind is INTERN or JOB
  const baseKind = (ov.kind && ov.kind !== 'ACHIEVEMENT' && ov.kind !== 'POSITION') ? ov.kind : (intern ? 'INTERN' : 'JOB');

  const base = {
    id: app ? app.id : '',
    uid: app ? app.uid : '',
    name: certName,
    empType,
    roleTitle: (ov.kind !== 'ACHIEVEMENT' && ov.kind !== 'POSITION' ? ov.roleTitle : null) || o.roles || (role && role.title) || (intern ? 'Intern' : 'Team Member'),
    department: (role && role.department) || '',
    kind: baseKind,
    startMs: start,
    plannedMonths: intern ? plannedMonths : null,
    note: (ov.kind !== 'ACHIEVEMENT' && ov.kind !== 'POSITION' ? ov.note : '') || '',
  };

  if (app && app.hiredEndType) return { ...base, state: 'revoked', eligible: false };
  if (!start) return { ...base, state: 'none', eligible: false };

  // Manual force issue (from Admin "Give Cert" or manual override)
  if (ov.forceIssue && ov.kind !== 'ACHIEVEMENT' && ov.kind !== 'POSITION') {
    const forceStart = toMs(ov.startMs || ov.startDate || start);
    const forceEnd = toMs(ov.endMs || ov.endDate) || now;
    const forceIssueDate = ov.issueDate ? toMs(ov.issueDate) : (toMs(ov.issuedAt) || forceEnd);
    const d = certDuration(forceStart, forceEnd);
    const forceMonths = ov.months != null && ov.months !== '' ? Number(ov.months) : d.months;
    const forceDays = d.days;
    const forceDurLabel = ov.durationLabel || (forceMonths != null && forceMonths > 0 ? fmtMonths(forceMonths, forceDays) : (forceDays > 0 ? `${forceDays} Day${forceDays === 1 ? '' : 's'}` : '1 Month'));
    return {
      ...base,
      startMs: forceStart,
      state: 'completed',
      endMs: forceEnd,
      plannedEndMs: null,
      days: forceDays,
      months: forceMonths,
      durationLabel: forceDurLabel,
      eligible: true,
      issuedMs: forceIssueDate,
      forceIssued: true
    };
  }

  const plannedEnd = intern ? addM(start, plannedMonths) : null;
  let end, state;
  let autoIssueDate = null;
  if (app.offerStatus === 'left') {
    end = toMs(app.offerLeftAt) || now;
    state = 'left';
    autoIssueDate = end;
  } else if (plannedEnd && now >= plannedEnd) {
    end = plannedEnd;
    state = 'completed';
    autoIssueDate = plannedEnd;
  } else {
    end = now;
    state = 'active';
    autoIssueDate = now;
  }
  if (plannedEnd && end > plannedEnd) end = plannedEnd;

  const d = certDuration(start, end);
  const full = plannedEnd && end >= plannedEnd;
  let months = full ? plannedMonths : d.months;
  if (ov.months != null && ov.months !== '' && ov.kind !== 'ACHIEVEMENT' && ov.kind !== 'POSITION') months = Number(ov.months);
  
  const eligible = state !== 'active' && (full || d.eligible || (ov.months != null && ov.kind !== 'ACHIEVEMENT' && ov.kind !== 'POSITION'));
  const finalIssued = (ov.issueDate && ov.kind !== 'ACHIEVEMENT' && ov.kind !== 'POSITION') ? toMs(ov.issueDate) : (autoIssueDate || end);
  const durationLabel = (ov.durationLabel && ov.kind !== 'ACHIEVEMENT' && ov.kind !== 'POSITION') ? ov.durationLabel : fmtMonths(months, d.days);

  return {
    ...base,
    state: full && state === 'left' ? 'completed' : state,
    endMs: end,
    plannedEndMs: plannedEnd,
    days: d.days,
    months,
    durationLabel,
    eligible,
    issuedMs: finalIssued
  };
}

/* Returns all certificates for this application (Achievement + Position + Experience) */
export function getAllCerts(app, role, now = Date.now()){
  const list = [];
  const ach = buildAchievementCert(app, role, now);
  if (ach) list.push(ach);
  const pos = buildPositionCert(app, role, now);
  if (pos) list.push(pos);
  const exp = buildCert(app, role, now);
  if (exp) list.push(exp);
  return list;
}

/* what gets mirrored to the public `certificates/{id}` doc (QR verification) */
export function publicDoc(c){
  return {
    uid: c.uid || '',
    name: c.name,
    roleTitle: c.roleTitle,
    department: c.department || '',
    kind: c.kind,
    empType: c.empType,
    startMs: c.startMs,
    endMs: c.endMs || null,
    isCurrent: !!c.isCurrent,
    months: c.months || null,
    durationLabel: c.durationLabel || '',
    issuedMs: c.issuedMs,
    note: c.note || '',
    status: 'valid',
    forceIssued: !!c.forceIssued,
    isAchievement: !!c.isAchievement,
    isPosition: !!c.isPosition,
    isExecutive: !!c.isExecutive
  };
}
