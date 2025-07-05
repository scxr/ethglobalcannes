import assert from "assert";
import { 
  TestHelpers,
  ChipInFactory_OwnershipTransferred
} from "generated";
const { MockDb, ChipInFactory } = TestHelpers;

describe("ChipInFactory contract OwnershipTransferred event tests", () => {
  // Create mock db
  const mockDb = MockDb.createMockDb();

  // Creating mock for ChipInFactory contract OwnershipTransferred event
  const event = ChipInFactory.OwnershipTransferred.createMockEvent({/* It mocks event fields with default values. You can overwrite them if you need */});

  it("ChipInFactory_OwnershipTransferred is created correctly", async () => {
    // Processing the event
    const mockDbUpdated = await ChipInFactory.OwnershipTransferred.processEvent({
      event,
      mockDb,
    });

    // Getting the actual entity from the mock database
    let actualChipInFactoryOwnershipTransferred = mockDbUpdated.entities.ChipInFactory_OwnershipTransferred.get(
      `${event.chainId}_${event.block.number}_${event.logIndex}`
    );

    // Creating the expected entity
    const expectedChipInFactoryOwnershipTransferred: ChipInFactory_OwnershipTransferred = {
      id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
      previousOwner: event.params.previousOwner,
      newOwner: event.params.newOwner,
    };
    // Asserting that the entity in the mock database is the same as the expected entity
    assert.deepEqual(actualChipInFactoryOwnershipTransferred, expectedChipInFactoryOwnershipTransferred, "Actual ChipInFactoryOwnershipTransferred should be the same as the expectedChipInFactoryOwnershipTransferred");
  });
});
