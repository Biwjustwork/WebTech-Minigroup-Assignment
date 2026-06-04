const { createHttpError } = require('./httpError');

function throwIfSupabaseError(error, fallbackMessage = 'Supabase request failed.') {
  if (!error) {
    return;
  }

  throw createHttpError(500, 'SUPABASE_ERROR', error.message || fallbackMessage);
}

function mapSupabaseRpcError(error) {
  if (!error) {
    return null;
  }

  if (error.message?.startsWith('PRODUCT_NOT_FOUND:')) {
    return createHttpError(404, 'PRODUCT_NOT_FOUND', error.message.replace('PRODUCT_NOT_FOUND: ', ''));
  }

  if (error.message?.startsWith('OUT_OF_STOCK:')) {
    return createHttpError(409, 'OUT_OF_STOCK', error.message.replace('OUT_OF_STOCK: ', ''));
  }

  return createHttpError(500, 'SUPABASE_ERROR', error.message || 'Supabase RPC failed.');
}

module.exports = {
  mapSupabaseRpcError,
  throwIfSupabaseError
};
