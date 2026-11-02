import {
  roundsQueryKey,
  supervisorSitesQueryKey,
  customRoundPeriod,
} from '../src/query/roundsQuery';
import type {User} from '../src/types/api';

const admin: User = {
  id: 'admin-1',
  companyId: 'company-1',
  roleType: 'COMPANY_ADMIN',
  fullName: 'Admin',
  email: 'admin@example.test',
  permissions: [],
};

const supervisor: User = {
  ...admin,
  id: 'supervisor-1',
  roleType: 'SUPERVISOR',
};

describe('clés privées des requêtes de rondes', () => {
  it('sépare les comptes, sociétés, rôles et périodes', () => {
    const today = roundsQueryKey(admin, {
      label: "Aujourd'hui",
      period: 'today',
    });
    const sevenDays = roundsQueryKey(admin, {label: '7 jours', period: '7d'});
    const thirtyDays = roundsQueryKey(admin, {
      label: '30 jours',
      period: '30d',
    });
    const supervisorSevenDays = roundsQueryKey(supervisor, {
      label: '7 jours',
      period: '7d',
    });
    const otherCompany = roundsQueryKey(
      {...supervisor, companyId: 'company-2'},
      {label: '7 jours', period: '7d'},
    );

    expect(today).not.toEqual(sevenDays);
    expect(sevenDays).not.toEqual(thirtyDays);
    expect(sevenDays).not.toEqual(supervisorSevenDays);
    expect(supervisorSevenDays).not.toEqual(otherCompany);
  });

  it('inclut la limite et laisse la page au pageParam de la requête infinie', () => {
    expect(roundsQueryKey(admin, {label: '7 jours', period: '7d'})).toEqual([
      'rounds',
      expect.objectContaining({period: '7d', limit: 20}),
    ]);
  });

  it('sépare aussi le périmètre de sites du superviseur', () => {
    expect(supervisorSitesQueryKey(supervisor)).toEqual([
      'sites',
      expect.objectContaining({
        userId: 'supervisor-1',
        companyId: 'company-1',
        roleType: 'SUPERVISOR',
      }),
    ]);
  });
});

it('separates combined server site/status/date filters without putting a page in the key', () => {
  const base = {
    period: 'custom' as const,
    from: '2026-03-22T00:00:00.000Z',
    to: '2026-03-24T00:00:00.000Z',
  };
  const keys = [
    roundsQueryKey(admin, base),
    roundsQueryKey(admin, {...base, siteId: 'site-a'}),
    roundsQueryKey(admin, {...base, siteId: 'site-b'}),
    roundsQueryKey(admin, {...base, status: 'STARTED'}),
    roundsQueryKey(admin, {...base, from: '2026-03-21T00:00:00.000Z'}),
    roundsQueryKey(admin, {...base, to: '2026-03-25T00:00:00.000Z'}),
  ];
  expect(new Set(keys.map(key => JSON.stringify(key))).size).toBe(keys.length);
  expect(keys[0][1]).not.toHaveProperty('page');
  expect(supervisorSitesQueryKey(supervisor, true)).not.toEqual(
    supervisorSitesQueryKey(supervisor),
  );
});
it('partitions supervisor snapshots when site assignments change without depending on site ordering', () => {
  const filter = {period: 'today' as const};
  expect(roundsQueryKey(supervisor, filter, ['a', 'b'])).toEqual(
    roundsQueryKey(supervisor, filter, ['b', 'a']),
  );
  expect(roundsQueryKey(supervisor, filter, ['a', 'b'])).not.toEqual(
    roundsQueryKey(supervisor, filter, ['b']),
  );
});
it.each(['15/02/2026', '22/03/2026', '02/11/2026'])(
  'encodes the civil Moroccan day %s without an offset shift',
  date => {
    const [day, month, year] = date.split('/');
    expect(customRoundPeriod(date, date)?.from).toBe(
      `${year}-${month}-${day}T00:00:00.000Z`,
    );
  },
);
it('uses an inclusive displayed end date and an exclusive API bound, including leap days', () => {
  expect(customRoundPeriod('28/02/2028', '29/02/2028')).toEqual({
    from: '2028-02-28T00:00:00.000Z',
    to: '2028-03-01T00:00:00.000Z',
  });
});
it.each([
  ['31/02/2026', '02/03/2026'],
  ['3/2/2026', '03/02/2026'],
  ['02/11/2026', '01/11/2026'],
  ['', '02/11/2026'],
])('refuses invalid or inverted dates %s to %s', (from, to) => {
  expect(customRoundPeriod(from, to)).toBeNull();
});
