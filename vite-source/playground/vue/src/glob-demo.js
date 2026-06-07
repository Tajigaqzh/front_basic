export const lazyModules = import.meta.glob('./features/*.js')

export const eagerNames = import.meta.glob('./features/*.js', {
  eager: true,
  import: 'name',
})

export async function loadFeature(key) {
  const mod = await import(`./features/${key}.js`)
  return mod.name
}
