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
  onSelect,
}: {
  profiles: AppBskyActorDefs.ProfileViewDetailed[]
  onSelect: (dids: string[]) => void
}) {
  const [dids, setDids] = React.useState<string[]>(profiles.map(p => p.did))

  React.useEffect(() => {
    onSelect(dids)
  }, [dids, onSelect])

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
  const {isLoading, isError, data, error} = useProfilesQuery({
    handles: state.interestsStepResults.accountDids,
  })
  const [dids, setDids] = React.useState<string[]>([])
  const [saving, setSaving] = React.useState(false)

  const interestsText = React.useMemo(() => {
    const i = state.interestsStepResults.interests.map(i => i.title)
    return i.join(', ')
  }, [state.interestsStepResults.interests])

  const handleBulkFollow = React.useCallback(async () => {
    setSaving(true)
    await new Promise(y => setTimeout(y, 1000))
    dispatch({type: 'setSuggestedAccountsStepResults', accountDids: dids})
    setSaving(false)
    dispatch({type: 'next'})
  }, [dids, setSaving, dispatch])

  return (
    <View style={[a.align_start, {paddingTop: gtMobile ? 100 : 60}]}>
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
      <Description>Based on your interests: {interestsText}</Description>

      <View style={[a.w_full, a.pt_xl]}>
        {isLoading ? (
          <Loader size="xl" />
        ) : isError || !data ? (
          <Text>{error?.toString()}</Text>
        ) : (
          <Inner profiles={data.profiles} onSelect={setDids} />
        )}
      </View>

      <OnboardingControls.Portal>
        <View style={[a.gap_md, gtMobile ? a.flex_row : a.flex_col]}>
          <Button
            disabled={dids.length === 0}
            variant="gradient"
            color="gradient_sky"
            size="large"
            label="Continue setting up your account"
            onPress={handleBulkFollow}>
            <ButtonText>Follow All</ButtonText>
            <ButtonIcon icon={saving ? Loader : Plus} />
          </Button>
          <Button
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
