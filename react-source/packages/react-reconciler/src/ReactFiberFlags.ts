export type Flags = number;

export const NoFlags = 0b0000;
export const Placement = 0b0001;
export const Update = 0b0010;
export const ChildDeletion = 0b0100;
export const Passive = 0b1000;
export const DidPropagateContext = 0b0001_0000;
export const NeedsPropagation = 0b0010_0000;
export const DidCapture = 0b0100_0000;
export const ShouldCapture = 0b1000_0000;
export const Incomplete = 0b0001_0000_0000;
export const ForceClientRender = 0b0010_0000_0000;
export const ScheduleRetry = 0b0100_0000_0000;
export const Forked = 0b1000_0000_0000;

export const MutationMask = Placement | Update | ChildDeletion;
export const PassiveMask = Passive;
