import {v4} from 'uuid';
import {
  expectWithMessage,
  ItBehavesLikeItValidatesCacheName,
  testCacheName,
  ValidateCacheProps,
  WithCache,
} from './common-int-test-utils';
import {ICacheClient} from '@gomomento/sdk-core/dist/src/clients/ICacheClient';
import {
  CreateCache,
  DeleteCache,
  ListCaches,
  MomentoErrorCode,
  CacheFlush,
  CacheGet,
  CacheSet,
} from '@gomomento/sdk-core';

export function runCreateDeleteListCacheTests(cacheClient: ICacheClient) {
  describe('create/delete cache', () => {
    ItBehavesLikeItValidatesCacheName((props: ValidateCacheProps) => {
      return cacheClient.createCache(props.cacheName);
    });

    ItBehavesLikeItValidatesCacheName((props: ValidateCacheProps) => {
      return cacheClient.deleteCache(props.cacheName);
    });

    it('should return NotFoundError if deleting a non-existent cache', async () => {
      const cacheName = testCacheName();
      const deleteResponse = await cacheClient.deleteCache(cacheName);
      expectWithMessage(() => {
        expect(deleteResponse).toBeInstanceOf(DeleteCache.Error);
      }, `expected ERROR but got ${deleteResponse.toString()}`);
      if (deleteResponse instanceof DeleteCache.Error) {
        expect(deleteResponse.errorCode()).toEqual(
          MomentoErrorCode.NOT_FOUND_ERROR
        );
      }
    });

    it('should return AlreadyExists response if trying to create a cache that already exists', async () => {
      const cacheName = testCacheName();
      await WithCache(cacheClient, cacheName, async () => {
        const createResponse = await cacheClient.createCache(cacheName);
        expect(createResponse).toBeInstanceOf(CreateCache.AlreadyExists);
      });
    });

    it('should create 1 cache and list the created cache', async () => {
      const cacheName = testCacheName();
      await WithCache(cacheClient, cacheName, async () => {
        const listResponse = await cacheClient.listCaches();
        expectWithMessage(() => {
          expect(listResponse).toBeInstanceOf(ListCaches.Success);
        }, `expected SUCCESS but got ${listResponse.toString()}`);
        if (listResponse instanceof ListCaches.Success) {
          const caches = listResponse.getCaches();
          const knownCaches = caches.filter(c => c.getName() === cacheName);
          expect(knownCaches.length === 1).toBeTrue();
          const cache = knownCaches[0];

          // checking cache limits
          expect(cache.getCacheLimits().maxThroughputKbps).toEqual(1024);
          expect(cache.getCacheLimits().maxItemSizeKb).toEqual(1024);
          expect(cache.getCacheLimits().maxTrafficRate).toEqual(100);
          expect(cache.getCacheLimits().maxTtlSeconds).toEqual(86400);

          // checking topic limits
          expect(cache.getTopicLimits().maxPublishMessageSizeKb).toEqual(100);
          expect(cache.getTopicLimits().maxPublishRate).toEqual(100);
          expect(cache.getTopicLimits().maxSubscriptionCount).toEqual(100);
        }
      });
    });
  });

  describe('flush cache', () => {
    ItBehavesLikeItValidatesCacheName((props: ValidateCacheProps) => {
      return cacheClient.flushCache(props.cacheName);
    });

    it('should return NotFoundError if flushing a non-existent cache', async () => {
      const cacheName = testCacheName();
      const flushResponse = await cacheClient.flushCache(cacheName);
      expectWithMessage(() => {
        expect(flushResponse).toBeInstanceOf(CacheFlush.Error);
      }, `expected ERROR but got ${flushResponse.toString()}`);
      if (flushResponse instanceof CacheFlush.Error) {
        expect(flushResponse.errorCode()).toEqual(
          MomentoErrorCode.NOT_FOUND_ERROR
        );
      }
    });

    it('should return success while flushing empty cache', async () => {
      const cacheName = testCacheName();
      await WithCache(cacheClient, cacheName, async () => {
        const flushResponse = await cacheClient.flushCache(cacheName);
        expectWithMessage(() => {
          expect(flushResponse).toBeInstanceOf(CacheFlush.Success);
        }, `expected SUCCESS but got ${flushResponse.toString()}`);
      });
    });

    it('should return success while flushing non-empty cache', async () => {
      const cacheName = testCacheName();
      const key1 = v4();
      const key2 = v4();
      const value1 = v4();
      const value2 = v4();
      await WithCache(cacheClient, cacheName, async () => {
        const setResponse1 = await cacheClient.set(cacheName, key1, value1);
        expectWithMessage(() => {
          expect(setResponse1).toBeInstanceOf(CacheSet.Success);
        }, `expected SUCCESS but got ${setResponse1.toString()}`);
        const setResponse2 = await cacheClient.set(cacheName, key2, value2);
        expectWithMessage(() => {
          expect(setResponse2).toBeInstanceOf(CacheSet.Success);
        }, `expected SUCCESS but got ${setResponse2.toString()}`);
        const flushResponse = await cacheClient.flushCache(cacheName);
        expectWithMessage(() => {
          expect(flushResponse).toBeInstanceOf(CacheFlush.Success);
        }, `expected SUCCESS but got ${flushResponse.toString()}`);
        const getResponse1 = await cacheClient.get(cacheName, key1);
        const getResponse2 = await cacheClient.get(cacheName, key2);
        expectWithMessage(() => {
          expect(getResponse1).toBeInstanceOf(CacheGet.Miss);
        }, `expected MISS but got ${getResponse1.toString()}`);
        expectWithMessage(() => {
          expect(getResponse2).toBeInstanceOf(CacheGet.Miss);
        }, `expected MISS but got ${getResponse2.toString()}`);
      });
    });
  });
}
