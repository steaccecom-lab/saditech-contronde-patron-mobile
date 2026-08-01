import {
  roundsQueryKey,
  supervisorSitesQueryKey,
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
    const today = roundsQueryKey(admin, {label: "Aujourd'hui", period: 'today'});
    const sevenDays = roundsQueryKey(admin, {label: '7 jours', period: '7d'});
    const thirtyDays = roundsQueryKey(admin, {label: '30 jours', period: '30d'});
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
