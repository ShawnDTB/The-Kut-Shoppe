import { useEffect, useState, type ReactNode } from 'react';
import { getCurrentAccount, isManagement, isStaff, endSessionEverywhere } from '../data/session';
import { formatPhone } from '../data/auth';
import { readNotifications, type NotificationRecord } from '../data/notifications';
import {
  claimWalkIn,
  confirmAppointment,
  declineAppointment,
  getBarberDirectory,
  hasAppointmentConflict,
  minutesToTimeLabel,
  proposeAppointmentTime,
  readAppointments,
  readStaffProfiles,
  subscribeToAppointmentChanges,
  timeLabelToMinutes,
  updateAppointment,
  type AppointmentStatus,
  type PlatformAppointment,
  type StaffProfile,
} from '../data/platform';

const staffLinks = [
  ['Overview', '/staff'],
  ['Calendar', '/staff/calendar'],
  ['Requests', '/staff/requests'],
  ['Waitlist', '/staff/waitlist'],
  ['Earnings', '/staff/earnings'],
  ['Payouts', '/staff/payouts'],
  ['Notifications', '/staff/notifications'],
  ['Settings', '/staff/settings'],
] as const;

type CalendarView = 'day' | 'week' | 'month';

function todayKey() {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  return date.toISOString().slice(0, 10);
}

function formatDate(dateKey: string, options?: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat('en-US', options ?? {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(new Date(`${dateKey}T12:00:00`));
}

function addDays(dateKey: string, amount: number) {
  const date = new Date(`${dateKey}T12:00:00`);
  date.setDate(date.getDate() + amount);
  return date.toISOString().slice(0, 10);
}

function startOfWeek(dateKey: string) {
  const date = new Date(`${dateKey}T12:00:00`);
  const mondayOffset = date.getDay() === 0 ? -6 : 1 - date.getDay();
  date.setDate(date.getDate() + mondayOffset);
  return date.toISOString().slice(0, 10);
}

function monthKeys(dateKey: string) {
  const date = new Date(`${dateKey}T12:00:00`);
  const year = date.getFullYear();
  const month = date.getMonth();
  const days = new Date(year, month + 1, 0).getDate();
  return Array.from({ length: days }, (_, index) => {
    const value = new Date(year, month, index + 1, 12, 0, 0, 0);
    return value.toISOString().slice(0, 10);
  });
}

function appointmentDateTime(appointment: PlatformAppointment) {
  return `${appointment.date}-${String(appointment.startMinutes).padStart(4, '0')}`;
}

function getProfileForSession() {
  const account = getCurrentAccount();
  if (!account?.staffProfileId) return null;
  return readStaffProfiles().find((profile) => profile.id === account.staffProfileId) ?? null;
}

function appointmentsVisibleToStaff(
  appointments: PlatformAppointment[],
  profile: StaffProfile,
  canManageAll: boolean,
) {
  if (canManageAll) return appointments;
  return appointments.filter((appointment) => (
    appointment.assignedBarberId === profile.id
    || (
      appointment.status === 'waitlisted'
      && profile.bookingRules.acceptsWalkIns
    )
  ));
}

function profilesVisibleToStaff(profile: StaffProfile, canManageAll: boolean) {
  return canManageAll ? readStaffProfiles() : [profile];
}

function StaffNav({ currentPath }: { currentPath: string }) {
  return (
    <nav className="staff-platform-nav" aria-label="Staff account">
      {staffLinks.map(([label, href]) => (
        <a href={href} aria-current={currentPath === href ? 'page' : undefined} key={href}>{label}</a>
      ))}
    </nav>
  );
}

function StaffShell({
  currentPath,
  children,
  profile,
}: {
  currentPath: string;
  children: ReactNode;
  profile: StaffProfile;
}) {
  const logout = () => {
    endSessionEverywhere();
    window.location.assign('/account');
  };

  return (
    <section className="section staff-platform-page platform-pattern platform-pattern-tools">
      <div className="container route-wide">
        <header className="staff-platform-header">
          <div>
            <p className="eyebrow">The Kut Shoppe staff platform</p>
            <h1>Manage your chair.</h1>
            <p>{profile.professionalName} · {profile.locationName}</p>
          </div>
          <div className="staff-session-actions">
            <a className="button button-secondary" href="/account">Customer account</a>
            <button className="text-button" type="button" onClick={logout}>Log out</button>
          </div>
        </header>
        <StaffNav currentPath={currentPath} />
        {children}
      </div>
    </section>
  );
}

function AppointmentActionPanel({
  appointment,
  profiles,
  onClose,
  onSaved,
}: {
  appointment: PlatformAppointment;
  profiles: StaffProfile[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const directory = getBarberDirectory(profiles);
  const [date, setDate] = useState(appointment.proposedDate ?? appointment.date);
  const [time, setTime] = useState(appointment.proposedTime ?? appointment.time.replace('Waiting list', '10:00 AM'));
  const [barberId, setBarberId] = useState(appointment.assignedBarberId ?? profiles[0]?.id ?? '');
  const [staffNote, setStaffNote] = useState(appointment.staffNote);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const selectedBarber = directory.find((barber) => (barber.profile?.id ?? barber.id) === barberId);
  const startMinutes = timeLabelToMinutes(time);
  const endMinutes = startMinutes + appointment.durationMinutes;

  const slotConflicts = () => (
    Boolean(barberId)
    && hasAppointmentConflict(
      barberId,
      date,
      startMinutes,
      endMinutes,
      readAppointments(),
      appointment.id,
    )
  );

  const saveDetails = () => {
    if (slotConflicts()) {
      setError('That barber already has a blocking appointment during the selected time.');
      return false;
    }
    updateAppointment(appointment.id, {
      date,
      time,
      startMinutes,
      endMinutes,
      assignedBarberId: barberId || null,
      barberName: selectedBarber?.name ?? appointment.barberName,
      staffNote,
    });
    setMessage('Appointment details updated.');
    setError('');
    onSaved();
    return true;
  };

  const confirm = () => {
    if (!saveDetails()) return;
    confirmAppointment(appointment.id, barberId);
    onSaved();
    onClose();
  };

  const decline = () => {
    declineAppointment(appointment.id, staffNote);
    onSaved();
    onClose();
  };

  const propose = () => {
    if (!selectedBarber || !date || !time || slotConflicts()) {
      setError('Choose an open barber, date, and time before proposing the appointment.');
      return;
    }
    proposeAppointmentTime(appointment.id, {
      date,
      time,
      startMinutes,
      assignedBarberId: barberId,
      barberName: selectedBarber.name,
      staffNote,
    });
    onSaved();
    onClose();
  };

  const claim = () => {
    if (!selectedBarber || !date || !time || slotConflicts()) {
      setError('Choose an open barber, date, and time before claiming the walk-in.');
      return;
    }
    claimWalkIn(appointment.id, {
      staffId: barberId,
      barberName: selectedBarber.name,
      date,
      time,
      startMinutes,
    });
    onSaved();
    onClose();
  };

  return (
    <div className="appointment-editor" role="dialog" aria-modal="true" aria-labelledby="appointment-editor-heading">
      <button className="appointment-editor-backdrop" type="button" aria-label="Close appointment editor" onClick={onClose} />
      <section>
        <div className="appointment-editor-heading"><div><p className="eyebrow">Manage request</p><h2 id="appointment-editor-heading">{appointment.customerName}</h2></div><button className="text-button" type="button" onClick={onClose}>Close</button></div>
        <dl className="appointment-editor-summary"><div><dt>Service</dt><dd>{appointment.serviceName}</dd></div><div><dt>Current status</dt><dd>{appointment.status.replaceAll('-', ' ')}</dd></div><div><dt>Phone</dt><dd>{formatPhone(appointment.customerPhone)}</dd></div><div><dt>Email</dt><dd>{appointment.customerEmail}</dd></div></dl>
        <div className="staff-form-grid">
          <label>Date<input type="date" value={date} onChange={(event) => { setDate(event.target.value); setError(''); }} /></label>
          <label>Time<input type="time" value={startMinutes ? `${String(Math.floor(startMinutes / 60)).padStart(2, '0')}:${String(startMinutes % 60).padStart(2, '0')}` : ''} onChange={(event) => { setTime(minutesToTimeLabel(Number(event.target.value.split(':')[0] ?? 0) * 60 + Number(event.target.value.split(':')[1] ?? 0))); setError(''); }} /></label>
          <label>Assigned barber<select value={barberId} onChange={(event) => { setBarberId(event.target.value); setError(''); }}><option value="">Unassigned</option>{directory.map((barber) => { const id = barber.profile?.id ?? barber.id; return <option value={id} key={id}>{barber.name}</option>; })}</select></label>
          <label className="staff-form-wide">Internal note<textarea rows={4} value={staffNote} onChange={(event) => setStaffNote(event.target.value)} /></label>
        </div>
        {appointment.customerNote ? <p className="appointment-customer-note"><strong>Customer note:</strong> {appointment.customerNote}</p> : null}
        {message ? <p className="success-message" role="status">{message}</p> : null}
        {error ? <p className="form-error" role="alert">{error}</p> : null}
        <div className="appointment-editor-actions">
          <button className="button button-secondary" type="button" onClick={saveDetails}>Save details</button>
          {appointment.status === 'waitlisted' ? <button className="button" type="button" disabled={!barberId} onClick={claim}>Claim and confirm</button> : <button className="button" type="button" disabled={!barberId} onClick={confirm}>Confirm appointment</button>}
          <button className="button button-secondary" type="button" disabled={!barberId} onClick={propose}>Propose this time</button>
          <button className="text-button danger" type="button" onClick={decline}>Decline request</button>
        </div>
      </section>
    </div>
  );
}

function AppointmentList({
  appointments,
  profiles,
  onSaved,
}: {
  appointments: PlatformAppointment[];
  profiles: StaffProfile[];
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState<PlatformAppointment | null>(null);

  return (
    <>
      <div className="staff-appointment-list">
        {appointments.map((appointment) => (
          <article key={appointment.id}>
            <time><span>{appointment.date}</span><strong>{appointment.time}</strong></time>
            <div><p className="eyebrow">{appointment.source.replace('-', ' ')}</p><h3>{appointment.customerName}</h3><p>{appointment.serviceName} · {appointment.barberName}</p></div>
            <span className={`staff-status staff-status-${appointment.status}`}>{appointment.status.replaceAll('-', ' ')}</span>
            <button className="button button-secondary" type="button" onClick={() => setEditing(appointment)}>Manage</button>
          </article>
        ))}
      </div>
      {editing ? <AppointmentActionPanel appointment={editing} profiles={profiles} onClose={() => setEditing(null)} onSaved={onSaved} /> : null}
    </>
  );
}

function StaffDashboardPage({ profile, canManageAll }: { profile: StaffProfile; canManageAll: boolean }) {
  const [appointments, setAppointments] = useState(() => appointmentsVisibleToStaff(readAppointments(), profile, canManageAll));
  const [notifications, setNotifications] = useState(() => readNotifications());
  const profiles = profilesVisibleToStaff(profile, canManageAll);

  useEffect(() => subscribeToAppointmentChanges(() => {
    setAppointments(appointmentsVisibleToStaff(readAppointments(), profile, canManageAll));
    setNotifications(readNotifications());
  }), [canManageAll, profile]);

  const pending = appointments.filter((appointment) => appointment.status === 'requested' || appointment.status === 'reschedule-proposed');
  const waitlist = appointments.filter((appointment) => appointment.status === 'waitlisted');
  const upcoming = appointments.filter((appointment) => appointment.status === 'confirmed').slice(0, 5);
  const visibleAppointmentIds = new Set(appointments.map((appointment) => appointment.id));
  const queuedNotifications = notifications.filter((notification) => (
    notification.status === 'queued'
    && (
      canManageAll
      || (
        notification.relatedType === 'appointment'
        && visibleAppointmentIds.has(notification.relatedId)
      )
    )
  ));

  return (
    <StaffShell currentPath="/staff" profile={profile}>
      <div className="staff-dashboard-grid">
        <section className="staff-dashboard-welcome"><p className="eyebrow">Welcome back</p><h2>{profile.professionalName}</h2><p>{profile.locationAddress}</p><div className="staff-dashboard-actions"><a className="button" href="/staff/calendar">Open calendar</a><a className="button button-secondary" href="/staff/settings">Edit availability</a></div></section>
        <section className="staff-stat-grid" aria-label="Staff summary">
          <article><small>Needs review</small><strong>{pending.length}</strong><span>appointment requests</span></article>
          <article><small>Waiting list</small><strong>{waitlist.length}</strong><span>last-minute clients</span></article>
          <article><small>Confirmed</small><strong>{upcoming.length}</strong><span>upcoming appointments</span></article>
          <article><small>Queued updates</small><strong>{queuedNotifications.length}</strong><span>email or SMS events</span></article>
        </section>
        <section className="staff-dashboard-panel staff-dashboard-wide"><div className="staff-panel-heading"><div><p className="eyebrow">Needs attention</p><h2>Appointment requests</h2></div><a href="/staff/requests">View all</a></div>{pending.length ? <AppointmentList appointments={pending.slice(0, 4)} profiles={profiles} onSaved={() => setAppointments(appointmentsVisibleToStaff(readAppointments(), profile, canManageAll))} /> : <p>No appointment requests are waiting for review.</p>}</section>
        <section className="staff-dashboard-panel"><div className="staff-panel-heading"><div><p className="eyebrow">Waiting list</p><h2>Open walk-ins</h2></div><a href="/staff/waitlist">Open queue</a></div>{waitlist.length ? <p>{waitlist.length} client{waitlist.length === 1 ? '' : 's'} waiting for a barber to claim or reschedule.</p> : <p>No walk-in requests are waiting.</p>}</section>
        <section className="staff-dashboard-panel"><div className="staff-panel-heading"><div><p className="eyebrow">Published hours</p><h2>This week</h2></div></div><dl className="staff-schedule-summary">{profile.schedule.map((window) => <div key={window.day}><dt>{window.label}</dt><dd>{window.enabled ? `${window.start} to ${window.end}` : 'Not available'}</dd></div>)}</dl></section>
      </div>
    </StaffShell>
  );
}

function StaffRequestsPage({ profile, canManageAll }: { profile: StaffProfile; canManageAll: boolean }) {
  const [appointments, setAppointments] = useState(() => appointmentsVisibleToStaff(readAppointments(), profile, canManageAll));
  const profiles = profilesVisibleToStaff(profile, canManageAll);
  useEffect(() => subscribeToAppointmentChanges(() => setAppointments(appointmentsVisibleToStaff(readAppointments(), profile, canManageAll))), [canManageAll, profile]);
  const requests = appointments.filter((appointment) => ['requested', 'reschedule-proposed'].includes(appointment.status));
  return <StaffShell currentPath="/staff/requests" profile={profile}><div className="staff-section-heading"><div><p className="eyebrow">Approval queue</p><h2>Appointment requests</h2></div></div>{requests.length ? <AppointmentList appointments={requests} profiles={profiles} onSaved={() => setAppointments(appointmentsVisibleToStaff(readAppointments(), profile, canManageAll))} /> : <div className="staff-empty-state"><h2>No requests need review.</h2></div>}</StaffShell>;
}

function StaffWaitlistPage({ profile, canManageAll }: { profile: StaffProfile; canManageAll: boolean }) {
  const [appointments, setAppointments] = useState(() => appointmentsVisibleToStaff(readAppointments(), profile, canManageAll));
  const profiles = profilesVisibleToStaff(profile, canManageAll);
  useEffect(() => subscribeToAppointmentChanges(() => setAppointments(appointmentsVisibleToStaff(readAppointments(), profile, canManageAll))), [canManageAll, profile]);
  const waitlist = appointments.filter((appointment) => appointment.status === 'waitlisted');
  return <StaffShell currentPath="/staff/waitlist" profile={profile}><div className="staff-section-heading"><div><p className="eyebrow">Walk-ins and last-minute clients</p><h2>Waiting list</h2></div><a className="button" href="/book/walk-in">Add a customer</a></div>{waitlist.length ? <AppointmentList appointments={waitlist} profiles={profiles} onSaved={() => setAppointments(appointmentsVisibleToStaff(readAppointments(), profile, canManageAll))} /> : <div className="staff-empty-state"><h2>The waiting list is clear.</h2><p>New walk-in requests appear here for the crew to claim or reschedule.</p></div>}</StaffShell>;
}

function CalendarToolbar({
  view,
  dateKey,
  onView,
  onDate,
}: {
  view: CalendarView;
  dateKey: string;
  onView: (view: CalendarView) => void;
  onDate: (dateKey: string) => void;
}) {
  const move = (direction: -1 | 1) => {
    if (view === 'day') onDate(addDays(dateKey, direction));
    if (view === 'week') onDate(addDays(dateKey, direction * 7));
    if (view === 'month') {
      const date = new Date(`${dateKey}T12:00:00`);
      date.setMonth(date.getMonth() + direction);
      onDate(date.toISOString().slice(0, 10));
    }
  };

  return (
    <div className="staff-calendar-toolbar">
      <div className="calendar-navigation"><button type="button" onClick={() => move(-1)} aria-label="Previous period">←</button><button type="button" onClick={() => onDate(todayKey())}>Today</button><button type="button" onClick={() => move(1)} aria-label="Next period">→</button></div>
      <strong>{view === 'month' ? formatDate(dateKey, { month: 'long', year: 'numeric' }) : view === 'week' ? `Week of ${formatDate(startOfWeek(dateKey))}` : formatDate(dateKey, { weekday: 'long', month: 'long', day: 'numeric' })}</strong>
      <div className="calendar-view-switch" role="group" aria-label="Calendar view"><button className={view === 'day' ? 'is-active' : ''} type="button" onClick={() => onView('day')}>Day</button><button className={view === 'week' ? 'is-active' : ''} type="button" onClick={() => onView('week')}>Week</button><button className={view === 'month' ? 'is-active' : ''} type="button" onClick={() => onView('month')}>Month</button></div>
    </div>
  );
}

function StaffCalendarPage({ profile, canManageAll }: { profile: StaffProfile; canManageAll: boolean }) {
  const [appointments, setAppointments] = useState(() => appointmentsVisibleToStaff(readAppointments(), profile, canManageAll));
  const [view, setView] = useState<CalendarView>('day');
  const [dateKey, setDateKey] = useState(todayKey);
  const [statusFilter, setStatusFilter] = useState<'all' | AppointmentStatus>('all');
  const [barberFilter, setBarberFilter] = useState('all');
  const profiles = profilesVisibleToStaff(profile, canManageAll);
  useEffect(() => subscribeToAppointmentChanges(() => setAppointments(appointmentsVisibleToStaff(readAppointments(), profile, canManageAll))), [canManageAll, profile]);

  const filtered = appointments.filter((appointment) => (
    (statusFilter === 'all' || appointment.status === statusFilter)
    && (barberFilter === 'all' || appointment.assignedBarberId === barberFilter)
  ));
  const visibleDates = view === 'day'
    ? [dateKey]
    : view === 'week'
      ? Array.from({ length: 7 }, (_, index) => addDays(startOfWeek(dateKey), index))
      : monthKeys(dateKey);
  const visible = filtered.filter((appointment) => visibleDates.includes(appointment.date)).sort((a, b) => appointmentDateTime(a).localeCompare(appointmentDateTime(b)));

  return (
    <StaffShell currentPath="/staff/calendar" profile={profile}>
      <div className="staff-section-heading"><div><p className="eyebrow">Appointments</p><h2>Calendar</h2></div><div className="staff-dashboard-actions"><a className="button" href="/book">Create request</a><a className="button button-secondary" href="/book/walk-in">Add walk-in</a></div></div>
      <CalendarToolbar view={view} dateKey={dateKey} onView={setView} onDate={setDateKey} />
      <div className="calendar-filters"><label>Status<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as 'all' | AppointmentStatus)}><option value="all">All statuses</option><option value="requested">Requested</option><option value="confirmed">Confirmed</option><option value="reschedule-proposed">Reschedule proposed</option><option value="waitlisted">Waitlisted</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option><option value="declined">Declined</option><option value="no-show">No-show</option></select></label>{canManageAll ? <label>Barber<select value={barberFilter} onChange={(event) => setBarberFilter(event.target.value)}><option value="all">All barbers</option>{profiles.map((staff) => <option value={staff.id} key={staff.id}>{staff.professionalName}</option>)}</select></label> : null}</div>
      {view === 'month' ? (
        <div className="staff-month-grid">{visibleDates.map((day) => { const dayAppointments = visible.filter((appointment) => appointment.date === day); return <button className={day === todayKey() ? 'is-today' : ''} type="button" key={day} onClick={() => { setDateKey(day); setView('day'); }}><span>{new Date(`${day}T12:00:00`).getDate()}</span><strong>{dayAppointments.length}</strong><small>{dayAppointments.length === 1 ? 'appointment' : 'appointments'}</small></button>; })}</div>
      ) : (
        <div className={view === 'week' ? 'staff-week-grid' : 'staff-day-view'}>
          {visibleDates.map((day) => {
            const dayAppointments = visible.filter((appointment) => appointment.date === day);
            return <section className="staff-calendar-day" key={day}><header><span>{formatDate(day, { weekday: 'short' })}</span><strong>{formatDate(day, { month: 'short', day: 'numeric' })}</strong><small>{dayAppointments.length} scheduled</small></header>{dayAppointments.length ? <AppointmentList appointments={dayAppointments} profiles={profiles} onSaved={() => setAppointments(appointmentsVisibleToStaff(readAppointments(), profile, canManageAll))} /> : <p className="calendar-empty">No matching appointments.</p>}</section>;
          })}
        </div>
      )}
    </StaffShell>
  );
}

function StaffEarningsPage({ profile }: { profile: StaffProfile }) {
  const completed = readAppointments().filter((appointment) => appointment.status === 'completed' && appointment.assignedBarberId === profile.id);
  const gross = completed.reduce((total, appointment) => total + appointment.priceCents, 0);
  return <StaffShell currentPath="/staff/earnings" profile={profile}><div className="staff-section-heading"><div><p className="eyebrow">Earnings ledger</p><h2>Completed services and shop sales</h2></div></div><div className="staff-stat-grid"><article><small>Gross service sales</small><strong>${(gross / 100).toFixed(2)}</strong><span>{completed.length} completed services</span></article><article><small>Tips recorded</small><strong>$0.00</strong><span>not enabled yet</span></article><article><small>Adjustments</small><strong>$0.00</strong><span>none recorded</span></article><article><small>Approved payout</small><strong>$0.00</strong><span>awaiting compensation rules</span></article></div><div className="staff-dashboard-panel"><p className="eyebrow">Ledger status</p><h2>Service totals are separated from payout rules.</h2><p>Completed appointments can feed the ledger now. Shop share, tips, taxes, booth rent, payroll, and staff share remain administrator-controlled business rules.</p></div></StaffShell>;
}

function StaffPayoutsPage({ profile }: { profile: StaffProfile }) {
  return <StaffShell currentPath="/staff/payouts" profile={profile}><div className="staff-section-heading"><div><p className="eyebrow">Payouts</p><h2>Track what the shop owes and pays.</h2></div></div><div className="staff-payout-layout"><section className="staff-dashboard-panel"><p className="eyebrow">Current mode</p><h2>Manual payout ledger</h2><p>The platform can record approved earnings and external payouts without storing bank account numbers.</p><dl className="staff-payout-summary"><div><dt>Available</dt><dd>$0.00</dd></div><div><dt>Pending review</dt><dd>$0.00</dd></div><div><dt>Last payout</dt><dd>None</dd></div></dl></section><section className="staff-dashboard-panel"><p className="eyebrow">Automated payouts</p><h2>Regulated transfer connection required</h2><p>Identity checks, tokenized bank setup, settlement, tax reporting, and disputes must be handled by a licensed provider before direct transfers are enabled.</p><button className="button" type="button" disabled>Connect payout destination later</button></section></div></StaffShell>;
}

function StaffNotificationsPage({ profile, canManageAll }: { profile: StaffProfile; canManageAll: boolean }) {
  const [notifications, setNotifications] = useState<NotificationRecord[]>(() => readNotifications());
  useEffect(() => subscribeToAppointmentChanges(() => setNotifications(readNotifications())), []);
  const visibleAppointmentIds = new Set(appointmentsVisibleToStaff(readAppointments(), profile, canManageAll).map((appointment) => appointment.id));
  const visibleNotifications = canManageAll
    ? notifications
    : notifications.filter((notification) => (
        notification.relatedType === 'appointment'
        && visibleAppointmentIds.has(notification.relatedId)
      ));
  return <StaffShell currentPath="/staff/notifications" profile={profile}><div className="staff-section-heading"><div><p className="eyebrow">Transactional messages</p><h2>Email and SMS outbox</h2></div></div><p className="staff-preview-notice">These records prove when the application would send a verification, confirmation, receipt, or status update. Production delivery still requires configured email and SMS transports.</p>{visibleNotifications.length ? <div className="notification-outbox">{visibleNotifications.slice().reverse().map((notification) => <article key={notification.id}><div><span>{notification.channel}</span><strong>{notification.subject}</strong><small>{notification.recipient}</small></div><p>{notification.message}</p><span className={`staff-status staff-status-${notification.status}`}>{notification.status}</span></article>)}</div> : <div className="staff-empty-state"><h2>No messages are available for this account.</h2></div>}</StaffShell>;
}

function StaffProtectedRoutes({ path }: { path: string }) {
  const account = getCurrentAccount();
  if (!account || !isStaff(account)) {
    return <section className="section staff-login-required platform-pattern platform-pattern-poles"><div className="container narrow-container"><div className="staff-empty-state"><p className="eyebrow">Staff sign-in required</p><h1>Open the protected staff portal.</h1><p>Appointment details, customer contact information, schedules, earnings, and payouts are available only after staff verification.</p><a className="button" href="/account">Staff sign in</a></div></div></section>;
  }

  // An account can be authenticated and staff-eligible (barber/manager/owner/
  // developer) but not yet linked to a StaffProfile -- e.g. a Manager or
  // Developer promoted through Access Manager who hasn't completed
  // professional setup. Previously this fell through to the same "Staff
  // sign-in required" screen above, which told an already-signed-in user to
  // sign in again -- a confusing dead end reachable straight from their own
  // dashboard's "Shop operations" links. Route it to the actual next step
  // instead, matching the "Professional setup required" callout already
  // shown on that dashboard.
  const profile = getProfileForSession();
  if (!profile) {
    return <section className="section staff-login-required platform-pattern platform-pattern-poles"><div className="container narrow-container"><div className="staff-empty-state"><p className="eyebrow">Professional setup required</p><h1>Finish setting up your professional profile.</h1><p>Add the shop profile, services, hours, and booking rules connected to this account before opening the staff portal.</p><a className="button" href="/staff/setup">Complete setup</a></div></div></section>;
  }

  const canManageAll = isManagement(account);
  if (path === '/staff/calendar') return <StaffCalendarPage profile={profile} canManageAll={canManageAll} />;
  if (path === '/staff/requests') return <StaffRequestsPage profile={profile} canManageAll={canManageAll} />;
  if (path === '/staff/waitlist') return <StaffWaitlistPage profile={profile} canManageAll={canManageAll} />;
  if (path === '/staff/earnings') return <StaffEarningsPage profile={profile} />;
  if (path === '/staff/payouts') return <StaffPayoutsPage profile={profile} />;
  if (path === '/staff/notifications') return <StaffNotificationsPage profile={profile} canManageAll={canManageAll} />;
  return <StaffDashboardPage profile={profile} canManageAll={canManageAll} />;
}

// /staff/login and /staff/setup never actually reach this component --
// App.tsx redirects /staff/login to /account and routes /staff/setup to
// StaffOnboardingV6 directly -- so this only ever handles the protected
// operational routes.
export function StaffPlatformPage({ path }: { path: string }) {
  return <StaffProtectedRoutes path={path} />;
}
