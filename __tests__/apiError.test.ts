import { AxiosError } from 'axios';
import { parseApiError } from '../src/services/apiError';

function responseError(status: number, data: unknown) {
  return new AxiosError('request failed', undefined, undefined, undefined, { status, data, headers: {}, config: {} as never, statusText: '' });
}

describe('parseApiError', () => {
  it('retourne toutes les erreurs imbriqu\u00e9es sans doublon', () => {
    const result = parseApiError(responseError(400, { error: { message: 'Validation failed', details: {
      formErrors: ['Erreur globale'], fieldErrors: { password: [['R\u00e8gle 1', 'R\u00e8gle 2'], 'R\u00e8gle 1'] },
    } } }));
    expect(result.messages).toEqual(['Erreur globale', 'R\u00e8gle 1', 'R\u00e8gle 2']);
    expect(result.field).toBe('password');
  });

  it('utilise le message de timeout', () => {
    const error = new AxiosError('timeout', 'ECONNABORTED');
    expect(parseApiError(error).messages).toEqual(['Le serveur met trop de temps \u00e0 r\u00e9pondre. Veuillez r\u00e9essayer.']);
  });

  it('traduit les statuts connus avant un message backend g\u00e9n\u00e9rique', () => {
    expect(parseApiError(responseError(403, { error: { message: 'Insufficient permissions' } })).messages)
      .toEqual(['Vous n\u2019avez pas l\u2019autorisation d\u2019effectuer cette action.']);
  });
});
