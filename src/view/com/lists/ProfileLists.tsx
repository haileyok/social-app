import React from 'react'
import {Dimensions, StyleProp, StyleSheet, View, ViewStyle} from 'react-native'
import {useQueryClient} from '@tanstack/react-query'
import {List, ListRef} from '../util/List'
import {ListCard} from './ListCard'
import {ErrorMessage} from '../util/error/ErrorMessage'
import {LoadMoreRetryBtn} from '../util/LoadMoreRetryBtn'
import {Text} from '../util/text/Text'
import {useAnalytics} from 'lib/analytics/analytics'
import {usePalette} from 'lib/hooks/usePalette'
import {useProfileListsQuery, RQKEY} from '#/state/queries/profile-lists'
import {logger} from '#/logger'
import {Trans, msg} from '@lingui/macro'
import {cleanError} from '#/lib/strings/errors'
import {useTheme} from '#/lib/ThemeContext'
import {FeedLoadingPlaceholder} from '#/view/com/util/LoadingPlaceholder'
import {isNative} from '#/platform/detection'
import {useLingui} from '@lingui/react'

const LOADING = {_reactKey: '__loading__'}
const EMPTY = {_reactKey: '__empty__'}
const ERROR_ITEM = {_reactKey: '__error__'}
const LOAD_MORE_ERROR_ITEM = {_reactKey: '__load_more_error__'}

interface SectionRef {
  scrollToTop: () => void
}

interface ProfileListsProps {
  did: string
  scrollElRef: ListRef
  headerOffset: number
  enabled?: boolean
  style?: StyleProp<ViewStyle>
  testID?: string
}

export const ProfileLists = React.forwardRef<SectionRef, ProfileListsProps>(
  function ProfileListsImpl(
    {did, scrollElRef, headerOffset, enabled, style, testID},
    ref,
  ) {
    const pal = usePalette('default')
    const theme = useTheme()
    const {track} = useAnalytics()
    const {_} = useLingui()
    const [isPTRing, setIsPTRing] = React.useState(false)
    const opts = React.useMemo(() => ({enabled}), [enabled])
    const {
      data,
      isFetching,
      isFetched,
      hasNextPage,
      fetchNextPage,
      isError,
      error,
      refetch,
    } = useProfileListsQuery(did, opts)
    const isEmpty = !isFetching && !data?.pages[0]?.lists.length

    const items = React.useMemo(() => {
      let items: any[] = []
      if (isError && isEmpty) {
        items = items.concat([ERROR_ITEM])
      }
      if (!isFetched && isFetching) {
        items = items.concat([LOADING])
      } else if (isEmpty) {
        items = items.concat([EMPTY])
      } else if (data?.pages) {
        for (const page of data?.pages) {
          items = items.concat(
            page.lists.map(l => ({
              ...l,
              _reactKey: l.uri,
            })),
          )
        }
      }
      if (isError && !isEmpty) {
        items = items.concat([LOAD_MORE_ERROR_ITEM])
      }
      return items
    }, [isError, isEmpty, isFetched, isFetching, data])

    // events
    // =

    const queryClient = useQueryClient()

    const onScrollToTop = React.useCallback(() => {
      scrollElRef.current?.scrollToOffset({
        animated: isNative,
        offset: -headerOffset,
      })
      queryClient.invalidateQueries({queryKey: RQKEY(did)})
    }, [scrollElRef, queryClient, headerOffset, did])

    React.useImperativeHandle(ref, () => ({
      scrollToTop: onScrollToTop,
    }))

    const onRefresh = React.useCallback(async () => {
      track('Lists:onRefresh')
      setIsPTRing(true)
      try {
        await refetch()
      } catch (err) {
        logger.error('Failed to refresh lists', {message: err})
      }
      setIsPTRing(false)
    }, [refetch, track, setIsPTRing])

    const onEndReached = React.useCallback(async () => {
      if (isFetching || !hasNextPage || isError) return

      track('Lists:onEndReached')
      try {
        await fetchNextPage()
      } catch (err) {
        logger.error('Failed to load more lists', {message: err})
      }
    }, [isFetching, hasNextPage, isError, fetchNextPage, track])

    const onPressRetryLoadMore = React.useCallback(() => {
      fetchNextPage()
    }, [fetchNextPage])

    // rendering
    // =

    const renderItemInner = React.useCallback(
      ({item}: {item: any}) => {
        if (item === EMPTY) {
          return (
            <View
              testID="listsEmpty"
              style={[{padding: 18, borderTopWidth: 1}, pal.border]}>
              <Text style={pal.textLight}>
                <Trans>You have no lists.</Trans>
              </Text>
            </View>
          )
        } else if (item === ERROR_ITEM) {
          return (
            <ErrorMessage
              message={cleanError(error)}
              onPressTryAgain={refetch}
            />
          )
        } else if (item === LOAD_MORE_ERROR_ITEM) {
          return (
            <LoadMoreRetryBtn
              label={_(
                msg`There was an issue fetching your lists. Tap here to try again.`,
              )}
              onPress={onPressRetryLoadMore}
            />
          )
        } else if (item === LOADING) {
          return <FeedLoadingPlaceholder />
        }
        return (
          <ListCard
            list={item}
            testID={`list-${item.name}`}
            style={styles.item}
          />
        )
      },
      [error, refetch, onPressRetryLoadMore, pal, _],
    )

    return (
      <View testID={testID} style={style}>
        <List
          testID={testID ? `${testID}-flatlist` : undefined}
          ref={scrollElRef}
          data={items}
          keyExtractor={(item: any) => item._reactKey}
          renderItem={renderItemInner}
          refreshing={isPTRing}
          onRefresh={onRefresh}
          headerOffset={headerOffset}
          contentContainerStyle={{
            minHeight: Dimensions.get('window').height * 1.5,
          }}
          indicatorStyle={theme.colorScheme === 'dark' ? 'white' : 'black'}
          removeClippedSubviews={true}
          // @ts-ignore our .web version only -prf
          desktopFixedHeight
          onEndReached={onEndReached}
        />
      </View>
    )
  },
)

const styles = StyleSheet.create({
  item: {
    paddingHorizontal: 18,
  },
})
