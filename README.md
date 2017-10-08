# ts-cache-decorator

###usage:  
only support async method. because the cache store is async.
if used on sync method, it will be cast to async function
####1. simple
```typescript
import { CacheMethod } from 'ts-cache-decorator';

class ClassA {
 
  @CacheMethod({ ttl: 60 })
  async methodA(){
    return /*some data will be cached*/
  }

}

```

####2. custom key or cache store 
cache store support redis and built in memory

```typescript
import { CacheMethod ,setDefaultStore,RedisCacheStore } from 'ts-cache-decorator';
import * as redis from 'redis'
function keyGenerator(objId: string, methodName: string, args: any[]){
  return 'some cache key'
}
const store = new RedisCacheStore(redis.createClient('redis://127.0.0.1:6379'))
// change default cache store
setDefaultStore(store)

class ClassA {
  
  // use special store
  @CacheMethod({ ttl: 60,key:keyGenerator },store)
  async methodA(){
    return /*some data will be cached*/
  }
  // use default cache store
  @CacheMethod({ ttl: 60 })
  async methodB(){
    return /*some data will be cached*/
  }

}

```
