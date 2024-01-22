import React from 'react'
import {View} from 'react-native'
import {AppBskyActorDefs} from '@atproto/api'

import {useTheme, atoms as a, useBreakpoints} from '#/alf'
import {PlusLarge_Stroke2_Corner0_Rounded as Plus} from '#/components/icons/Plus'
import {At_Stroke2_Corner0_Rounded as At} from '#/components/icons/At'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import {Text} from '#/components/Typography'
import {useProfilesQuery} from '#/state/queries/profile'
import {Loader} from '#/components/Loader'
import * as Toggle from '#/components/forms/Toggle'

import {Context} from '#/screens/Onboarding/state'
import {
  Title,
  Description,
  OnboardingControls,
} from '#/screens/Onboarding/Layout'
import {SuggestedAccountCard} from '#/screens/Onboarding/StepSuggestedAccounts/SuggestedAccountCard'

export function Inner({
  profiles,
}: {
  profiles: AppBskyActorDefs.ProfileViewDetailed[]
}) {
  const [dids, setDids] = React.useState<string[]>(profiles.map(p => p.did))

  return (
    <Toggle.Group
      values={dids}
      onChange={setDids}
      label="Select accounts to follow">
      {profiles.map(profile => (
        <Toggle.Item
          key={profile.did}
          name={profile.did}
          label={`Follow ${profile.handle}`}>
          <SuggestedAccountCard profile={profile} />
        </Toggle.Item>
      ))}
    </Toggle.Group>
  )
}

export function StepSuggestedAccounts() {
  const t = useTheme()
  const {state, dispatch} = React.useContext(Context)
  const {gtMobile} = useBreakpoints()
  const {isLoading, isError, data} = useProfilesQuery({
    handles: state.suggestedAccountHandles,
  })

  return (
    <View style={[a.align_start]}>
      <View
        style={[
          a.p_lg,
          a.mb_3xl,
          a.rounded_full,
          {
            backgroundColor:
              t.name === 'light' ? t.palette.primary_25 : t.palette.primary_975,
          },
        ]}>
        <At size="xl" fill={t.palette.primary_500} />
      </View>

      <Title>Here are some accounts for your to follow:</Title>
      <Description>Based on your interest in Pets and Books.</Description>

      <View style={[a.w_full, a.pt_xl]}>
        {isLoading ? (
          <Loader />
        ) : isError || !data ? (
          <Text>Error</Text>
        ) : (
          <Inner profiles={data.profiles} />
        )}
      </View>

      <OnboardingControls.Portal>
        <View style={[a.gap_md, gtMobile ? a.flex_row : a.flex_col]}>
          <Button
            key={state.activeStep} // remove focus state on nav
            variant="gradient"
            color="gradient_sky"
            size="large"
            label="Continue setting up your account"
            onPress={() => dispatch({type: 'next'})}>
            <ButtonText>Follow All</ButtonText>
            <ButtonIcon icon={Plus} />
          </Button>
          <Button
            key={state.activeStep + '2'} // remove focus state on nav
            variant="outline"
            color="secondary"
            size="large"
            label="Continue setting up your account"
            onPress={() => dispatch({type: 'next'})}>
            Skip
          </Button>
        </View>
      </OnboardingControls.Portal>
    </View>
  )
}