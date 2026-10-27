// environment
export const MIN_PER_DAY = 2;
export const MAX_NUM_BEES = 100;
export const NUM_PATCHES = 100;
export const WORLD_SIZE = 400;
export const MILES_TO_UNIT = 10; // each mile is 100 units 
export const MIN_IN_A_DAY = 24 * 60;

// bee-related
export const BEE_COLLECTION_TIME = 40 / MIN_IN_A_DAY; // 40 mins ==> 0.x of a day
export const BEE_NECTAR_CAPACITY = 2;
export const BEE_COLLECTION_RATE = 0.5 * BEE_COLLECTION_TIME / BEE_NECTAR_CAPACITY;
export const EMPTY_BEE_SPEED = 20; // 20 mph as maximum speed when unencumbered
export const FULL_BEE_SPEED = 12; // 12 mph as minimum speed when encumbered

// hive factors
export const HONEY_PER_LARVA = 1;

// flower factors
export const RECOUP_TIME = 0.25; // 6 hours to recover nectar
