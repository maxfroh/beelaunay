// environment
export const MIN_PER_DAY = 0.5;
export const MAX_NUM_BEES = 40;//200;
export const NUM_PATCHES = 80;
export const WORLD_SIZE = 400;
export const MILES_TO_UNIT = 10; // each mile is 100 units 
export const MIN_IN_A_DAY = 24 * 60;
export const Y = 4;

// bee-related
export const BEE_COLLECTION_TIME = 60 / MIN_IN_A_DAY; // 60 mins ==> 0.x of a day for one unit of honey
export const BEE_NECTAR_CAPACITY = 2;
export const BEE_COLLECTION_RATE = 1 / (BEE_COLLECTION_TIME * BEE_NECTAR_CAPACITY);
export const EMPTY_BEE_SPEED = 20; // 20 mph as maximum speed when unencumbered
export const FULL_BEE_SPEED = 12; // 12 mph as minimum speed when encumbered
export const WAKE_UP_TIME = 7 / 24;
export const SLEEP_TIME = 20 / 24;

// hive factors
export const HONEY_PER_LARVA = 1;

// flower factors
export const RECOUP_TIME = 0.25; // 6 hours to recover nectar
export const MAX_SIZE = 5;
export const MIN_SIZE = 1;

