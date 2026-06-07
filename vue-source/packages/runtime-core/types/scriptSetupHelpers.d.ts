// Note: this file is auto concatenated to the end of the bundled d.ts during
// build.

export {}

type RuntimeCoreSetupHelpers = typeof import('../src/apiSetupHelpers')

type _defineProps = RuntimeCoreSetupHelpers['defineProps']
type _defineEmits = RuntimeCoreSetupHelpers['defineEmits']
type _defineExpose = RuntimeCoreSetupHelpers['defineExpose']
type _defineOptions = RuntimeCoreSetupHelpers['defineOptions']
type _defineSlots = RuntimeCoreSetupHelpers['defineSlots']
type _defineModel = RuntimeCoreSetupHelpers['defineModel']
type _withDefaults = RuntimeCoreSetupHelpers['withDefaults']

declare global {
  const defineProps: _defineProps
  const defineEmits: _defineEmits
  const defineExpose: _defineExpose
  const defineOptions: _defineOptions
  const defineSlots: _defineSlots
  const defineModel: _defineModel
  const withDefaults: _withDefaults
}
