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
  return SGP.publicBase + 'certificate.html?v=' + encodeURIComponent(id);
}

export function certTitle(kind){
  if (kind === 'INTERN') return 'Certificate of Internship';
  if (kind === 'ACHIEVEMENT') return 'Certificate of Achievement';
  return 'Experience Certificate';
}

/* app = hiringApplications doc (+id), role = hiringRoles doc */
export function buildCert(app, role, now = Date.now()){
  const o = (app && app.offer) || {}, ov = (app && app.certOverride) || {};
  const empType = o.jobType || (role && role.employmentType) || 'FULL_TIME';
  const intern = empType === 'INTERN';
  const plannedMonths = Number(o.durationMonths) || 6;
  const start = toMs(app && app.offerAcceptedAt);
  const certName = (ov.name || app.certName || app.name || '').trim();

  const base = {
    id: app ? app.id : '',
    uid: app ? app.uid : '',
    name: certName,
    empType,
    roleTitle: ov.roleTitle || o.roles || (role && role.title) || 'Team Member',
    department: (role && role.department) || '',
    kind: ov.kind || (intern ? 'INTERN' : 'JOB'),
    startMs: start,
    plannedMonths: intern ? plannedMonths : null,
    note: ov.note || '',
  };

  if (app && app.hiredEndType) return { ...base, state: 'revoked', eligible: false };
  if (!start) return { ...base, state: 'none', eligible: false };

  // Admin force-issue — bypasses the 15-day rule entirely
  if (ov.forceIssue) {
    const forceEnd = ov.issueDate ? toMs(ov.issueDate) : now;
    const forceMonths = ov.months != null && ov.months !== '' ? Number(ov.months) : null;
    const forceDays = Math.max(0, Math.floor((forceEnd - start) / 864e5));
    const forceDurLabel = ov.durationLabel || (forceMonths != null ? fmtMonths(forceMonths, forceDays) : (forceDays > 0 ? `${forceDays} Days` : '1 Month'));
    return {
      ...base,
      state: 'completed',
      endMs: forceEnd,
      plannedEndMs: null,
      days: forceDays,
      months: forceMonths,
      durationLabel: forceDurLabel,
      eligible: true,
      issuedMs: forceEnd,
      forceIssued: true
    };
  }

  const plannedEnd = intern ? addM(start, plannedMonths) : null;
  let end, state;
  if (app.offerStatus === 'left') {
    end = toMs(app.offerLeftAt) || now;
    state = 'left';
  } else if (plannedEnd && now >= plannedEnd) {
    end = plannedEnd;
    state = 'completed';
  } else {
    end = now;
    state = 'active';
  }
  if (plannedEnd && end > plannedEnd) end = plannedEnd;

  const d = certDuration(start, end);
  const full = plannedEnd && end >= plannedEnd;
  let months = full ? plannedMonths : d.months;
  if (ov.months != null && ov.months !== '') months = Number(ov.months);
  
  const eligible = state !== 'active' && (full || d.eligible || ov.months != null || ov.forceIssue);
  const issued = ov.issueDate ? toMs(ov.issueDate) : end;
  const durationLabel = ov.durationLabel || fmtMonths(months, d.days);

  return {
    ...base,
    state: full && state === 'left' ? 'completed' : state,
    endMs: end,
    plannedEndMs: plannedEnd,
    days: d.days,
    months,
    durationLabel,
    eligible,
    issuedMs: issued
  };
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
    endMs: c.endMs,
    months: c.months,
    durationLabel: c.durationLabel,
    issuedMs: c.issuedMs,
    note: c.note || '',
    status: 'valid',
    forceIssued: !!c.forceIssued,
  };
}
