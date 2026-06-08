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
