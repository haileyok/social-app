import React from 'react'
import Animated, {
  Easing,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'

import {atoms as a} from '#/alf'
import {Props, useCommonSVGProps} from '#/components/icons/common'
import {Loader_Stroke2_Corner0_Rounded as Icon} from '#/components/icons/Loader'

export function Loader(props: Props) {
  const common = useCommonSVGProps(props)
  const rotation = useSharedValue(0)

  const animatedStyles = useAnimatedStyle(() => ({
    transform: [{rotate: rotation.value + 'deg'}],
  }))

  React.useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, {duration: 500, easing: Easing.linear}),
      -1,
    )
  }, [rotation])

  return (
    <Animated.View
      style={[
        a.relative,
        a.justify_center,
        a.align_center,
        {width: common.size, height: common.size},
        animatedStyles,
      ]}>
      <Icon {...props} style={[a.absolute, a.inset_0, props.style]} />
    </Animated.View>
  )
}
