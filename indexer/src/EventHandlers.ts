/*
 * Please refer to https://docs.envio.dev for a thorough guide on all Envio indexer features
 */
import {
  ChipInFactory,
  ChipInFactory_OwnershipTransferred,
  ChipInFactory_PoolCreated,
  ChipInFactory_SwapExecuted,
} from "generated";

ChipInFactory.OwnershipTransferred.handler(async ({ event, context }) => {
  const entity: ChipInFactory_OwnershipTransferred = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    previousOwner: event.params.previousOwner,
    newOwner: event.params.newOwner,
  };

  context.ChipInFactory_OwnershipTransferred.set(entity);
});

ChipInFactory.PoolCreated.handler(async ({ event, context }) => {
  const entity: ChipInFactory_PoolCreated = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    poolId: event.params.poolId,
    poolAddress: event.params.poolAddress,
    creator: event.params.creator,
    title: event.params.title,
    targetAmount: event.params.targetAmount,
    targetToken: event.params.targetToken,
  };

  context.ChipInFactory_PoolCreated.set(entity);
});

ChipInFactory.SwapExecuted.handler(async ({ event, context }) => {
  const entity: ChipInFactory_SwapExecuted = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    poolId: event.params.poolId,
    targetToken: event.params.targetToken,
    usdcAmount: event.params.usdcAmount,
    tokensReceived: event.params.tokensReceived,
  };

  context.ChipInFactory_SwapExecuted.set(entity);
});
