import { createHmac, createHash, timingSafeEqual } from 'node:crypto';
import ApiKey from '../models/ApiKey.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';

const digest = (value) => createHash('sha256').update(value).digest('hex');

export default asyncHandler(async (request, response, next) => {
  const rawKey = request.get('x-api-key');
  if (!rawKey || rawKey.length > 256) throw new ApiError(401, 'A valid billing API key is required.');
  const keyHash = digest(rawKey);
  const key = await ApiKey.findOne({ keyHash, isActive: true });
  if (!key) throw new ApiError(401, 'A valid billing API key is required.');

  const signature = request.get('x-api-signature');
  if (signature) {
    const expected = createHmac('sha256', rawKey).update(request.rawBody || Buffer.alloc(0)).digest('hex');
    const supplied = signature.replace(/^sha256=/i, '').toLowerCase();
    const expectedBuffer = Buffer.from(expected, 'hex');
    const suppliedBuffer = Buffer.from(supplied, 'hex');
    if (
      suppliedBuffer.length !== expectedBuffer.length
      || !timingSafeEqual(suppliedBuffer, expectedBuffer)
    ) {
      throw new ApiError(401, 'The billing request signature is invalid.');
    }
  }

  await ApiKey.updateOne({ _id: key._id, isActive: true }, { $set: { lastUsedAt: new Date() } });
  request.billingApiKey = key;
  next();
});
