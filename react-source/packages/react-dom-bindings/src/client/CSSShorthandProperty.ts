/**
 * @beginner-module: 源码导读
 * 本文件属于 DOM 绑定层，负责创建/更新 DOM 属性、事件、表单值或宿主配置。
 * 阅读建议：先看这些中文注释建立概念，再回到代码名和类型名理解真实实现。
 */
// @beginner: 声明 shorthandToLonghand：保存当前步骤需要读取或更新的数据。
const shorthandToLonghand: Record<string, string[]> = {
  animation: ["animationDelay", "animationDirection", "animationDuration", "animationFillMode", "animationIterationCount", "animationName", "animationPlayState", "animationTimingFunction"],
  background: ["backgroundAttachment", "backgroundClip", "backgroundColor", "backgroundImage", "backgroundOrigin", "backgroundPositionX", "backgroundPositionY", "backgroundRepeat", "backgroundSize"],
  border: ["borderBottomColor", "borderBottomStyle", "borderBottomWidth", "borderImageOutset", "borderImageRepeat", "borderImageSlice", "borderImageSource", "borderImageWidth", "borderLeftColor", "borderLeftStyle", "borderLeftWidth", "borderRightColor", "borderRightStyle", "borderRightWidth", "borderTopColor", "borderTopStyle", "borderTopWidth"],
  borderColor: ["borderBottomColor", "borderLeftColor", "borderRightColor", "borderTopColor"],
  borderStyle: ["borderBottomStyle", "borderLeftStyle", "borderRightStyle", "borderTopStyle"],
  borderWidth: ["borderBottomWidth", "borderLeftWidth", "borderRightWidth", "borderTopWidth"],
  font: ["fontFamily", "fontFeatureSettings", "fontKerning", "fontSize", "fontSizeAdjust", "fontStretch", "fontStyle", "fontVariant", "fontVariantCaps", "fontVariantLigatures", "fontVariantNumeric", "fontWeight", "lineHeight"],
  margin: ["marginBottom", "marginLeft", "marginRight", "marginTop"],
  padding: ["paddingBottom", "paddingLeft", "paddingRight", "paddingTop"],
  transition: ["transitionDelay", "transitionDuration", "transitionProperty", "transitionTimingFunction"],
};

export default shorthandToLonghand;
