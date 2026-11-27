export const MISSING_TABLE_CODE = 'PGRST205';

export function isMissingTableError(error) {
    if (!error) return false;
    if (error.code === MISSING_TABLE_CODE) return true;
    return /could not find the table|relation .* does not exist/i.test(String(error.message || ''));
}

// Tracks optional tables verified absent from the live schema, so callers can
// skip queries that would always 404 until the tables are provisioned.
export const dbCapabilities = {
    folioRoutingRules: true
};
