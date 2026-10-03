import { OptionsRepository } from 'emdash';
import { createSettingsAccess, resolvePluginEncryptionKeys } from 'emdash/internal/plugins/host';
import { settingsSchema } from '../plugins/sably-integrations/model';
/** Use EmDash's own versioned encryption format, including key rotation. */
export async function integrationSettings(db:ConstructorParameters<typeof OptionsRepository>[0],env:{EMDASH_ENCRYPTION_KEY?:string}) {
  return createSettingsAccess(new OptionsRepository(db),'sably-integrations',settingsSchema,await resolvePluginEncryptionKeys(env));
}
