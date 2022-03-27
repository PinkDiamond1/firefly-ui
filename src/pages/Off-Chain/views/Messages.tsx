// Copyright © 2022 Kaleido, Inc.
//
// SPDX-License-Identifier: Apache-2.0
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { Box, Chip, Grid } from '@mui/material';
import { BarDatum } from '@nivo/bar';
import dayjs from 'dayjs';
import React, { useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Histogram } from '../../../components/Charts/Histogram';
import { FilterButton } from '../../../components/Filters/FilterButton';
import { FilterModal } from '../../../components/Filters/FilterModal';
import { Header } from '../../../components/Header';
import { ChartTableHeader } from '../../../components/Headers/ChartTableHeader';
import { HashPopover } from '../../../components/Popovers/HashPopover';
import { MessageSlide } from '../../../components/Slides/MessageSlide';
import { FFTableText } from '../../../components/Tables/FFTableText';
import { DataTable } from '../../../components/Tables/Table';
import { ApplicationContext } from '../../../contexts/ApplicationContext';
import { DateFilterContext } from '../../../contexts/DateFilterContext';
import { FilterContext } from '../../../contexts/FilterContext';
import { SlideContext } from '../../../contexts/SlideContext';
import { SnackbarContext } from '../../../contexts/SnackbarContext';
import {
  BucketCollectionEnum,
  BucketCountEnum,
  FF_Paths,
  IDataTableRecord,
  IMessage,
  IMetric,
  IPagedMessageResponse,
  MessageFilters,
} from '../../../interfaces';
import {
  FF_MESSAGES_CATEGORY_MAP,
  MsgStateColorMap,
} from '../../../interfaces/enums';
import { FF_TX_CATEGORY_MAP } from '../../../interfaces/enums/transactionTypes';
import {
  DEFAULT_HIST_HEIGHT,
  DEFAULT_PADDING,
  DEFAULT_PAGE_LIMITS,
} from '../../../theme';
import { fetchCatcher, getFFTime, makeMsgHistogram } from '../../../utils';
import {
  isHistogramEmpty,
  makeColorArray,
  makeKeyArray,
} from '../../../utils/charts';
import { isEventType, WsEventTypes } from '../../../utils/wsEvents';

export const OffChainMessages: () => JSX.Element = () => {
  const { lastEvent, selectedNamespace } = useContext(ApplicationContext);
  const { dateFilter } = useContext(DateFilterContext);
  const { filterAnchor, setFilterAnchor, filterString } =
    useContext(FilterContext);
  const { slideQuery, addSlideToParams } = useContext(SlideContext);
  const { reportFetchError } = useContext(SnackbarContext);
  const { t } = useTranslation();
  const [isMounted, setIsMounted] = useState(false);
  // Messages
  const [messages, setMessages] = useState<IMessage[]>();
  const [messageTotal, setMessageTotal] = useState(0);
  // Messages histogram
  const [messageHistData, setMessageHistData] = useState<BarDatum[]>();
  // View message slide out
  const [viewMsg, setViewMsg] = useState<IMessage | undefined>();

  const [currentPage, setCurrentPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(DEFAULT_PAGE_LIMITS[1]);

  // Last event tracking
  const [numNewEvents, setNumNewEvents] = useState(0);
  const [lastRefreshTime, setLastRefresh] = useState<string>(
    new Date().toISOString()
  );

  useEffect(() => {
    isMounted &&
      isEventType(lastEvent, WsEventTypes.MESSAGE) &&
      setNumNewEvents(numNewEvents + 1);
  }, [lastEvent]);

  const refreshData = () => {
    setNumNewEvents(0);
    setLastRefresh(new Date().toString());
  };

  useEffect(() => {
    setIsMounted(true);
    setNumNewEvents(0);
    return () => {
      setIsMounted(false);
    };
  }, []);

  useEffect(() => {
    isMounted &&
      slideQuery &&
      fetchCatcher(
        `${FF_Paths.nsPrefix}/${selectedNamespace}${FF_Paths.messagesById(
          slideQuery
        )}`
      )
        .then((messageRes: IMessage) => {
          setViewMsg(messageRes);
        })
        .catch((err) => {
          reportFetchError(err);
        });
  }, [slideQuery, isMounted]);

  // Messages
  useEffect(() => {
    isMounted &&
      fetchCatcher(
        `${FF_Paths.nsPrefix}/${selectedNamespace}${
          FF_Paths.messages
        }?limit=${rowsPerPage}&count&skip=${rowsPerPage * currentPage}${
          dateFilter.filterString
        }${filterString ?? ''}`
      )
        .then((msgRes: IPagedMessageResponse) => {
          if (isMounted) {
            setMessages(msgRes.items);
            setMessageTotal(msgRes.total);
          }
        })
        .catch((err) => {
          reportFetchError(err);
        })
        .finally(() => numNewEvents !== 0 && setNumNewEvents(0));
  }, [
    rowsPerPage,
    currentPage,
    selectedNamespace,
    dateFilter,
    filterString,
    lastRefreshTime,
    isMounted,
  ]);

  // Histogram
  useEffect(() => {
    const currentTime = dayjs().unix();

    isMounted &&
      fetchCatcher(
        `${FF_Paths.nsPrefix}/${selectedNamespace}${FF_Paths.chartsHistogram(
          BucketCollectionEnum.Messages,
          dateFilter.filterTime,
          currentTime,
          BucketCountEnum.Large
        )}`
      )
        .then((histTypes: IMetric[]) => {
          isMounted && setMessageHistData(makeMsgHistogram(histTypes));
        })
        .catch((err) => {
          reportFetchError(err);
        });
  }, [selectedNamespace, dateFilter, lastRefreshTime, isMounted]);

  const msgColumnHeaders = [
    t('type'),
    t('id'),
    t('author'),
    t('transactionType'),
    t('tag'),
    t('topic'),
    t('created'),
    t('state'),
  ];

  const msgRecords: IDataTableRecord[] | undefined = messages?.map((msg) => ({
    key: msg.header.id,
    columns: [
      {
        value: (
          <FFTableText
            color="primary"
            text={t(FF_MESSAGES_CATEGORY_MAP[msg?.header.type]?.nicename)}
          />
        ),
      },
      {
        value: (
          <HashPopover shortHash={true} address={msg?.header.id}></HashPopover>
        ),
      },
      {
        value: (
          <HashPopover
            shortHash={true}
            address={msg?.header.author}
          ></HashPopover>
        ),
      },
      {
        value: (
          <FFTableText
            color="primary"
            text={t(FF_TX_CATEGORY_MAP[msg?.header.txtype]?.nicename)}
          />
        ),
      },
      {
        value: msg.header.tag ? (
          <HashPopover address={msg.header.tag} />
        ) : (
          <FFTableText color="secondary" text={t('noTagInMessage')} />
        ),
      },
      {
        value: msg.header.topics ? (
          <HashPopover shortHash address={msg.header.topics.toString()} />
        ) : (
          <FFTableText color="secondary" text={t('noTopicsInMessage')} />
        ),
      },
      {
        value: (
          <FFTableText color="secondary" text={getFFTime(msg.header.created)} />
        ),
      },
      {
        value: (
          // TODO: Fix when https://github.com/hyperledger/firefly/issues/628 is resolved
          <Chip
            label={
              msg.state?.toLocaleUpperCase() === 'PENDING'
                ? 'CONFIRMED'
                : msg.state?.toLocaleUpperCase()
            }
            sx={{
              backgroundColor:
                MsgStateColorMap[
                  msg.state === 'pending' ? 'confirmed' : msg.state
                ],
            }}
          ></Chip>
        ),
      },
    ],
    onClick: () => {
      setViewMsg(msg);
      addSlideToParams(msg.header.id);
    },
    leftBorderColor: FF_MESSAGES_CATEGORY_MAP[msg.header.type]?.color,
  }));

  return (
    <>
      <Header
        title={t('messages')}
        subtitle={t('offChain')}
        onRefresh={refreshData}
        numNewEvents={numNewEvents}
      ></Header>
      <Grid container px={DEFAULT_PADDING}>
        <Grid container item wrap="nowrap" direction="column">
          <ChartTableHeader
            title={t('allMessages')}
            filter={
              <FilterButton
                onSetFilterAnchor={(e: React.MouseEvent<HTMLButtonElement>) =>
                  setFilterAnchor(e.currentTarget)
                }
              />
            }
          />
          <Box height={DEFAULT_HIST_HEIGHT}>
            <Histogram
              colors={makeColorArray(FF_MESSAGES_CATEGORY_MAP)}
              data={messageHistData}
              indexBy="timestamp"
              keys={makeKeyArray(FF_MESSAGES_CATEGORY_MAP)}
              includeLegend={true}
              emptyText={t('noMessages')}
              isEmpty={isHistogramEmpty(messageHistData ?? [])}
            />
          </Box>
          <DataTable
            onHandleCurrPageChange={(currentPage: number) =>
              setCurrentPage(currentPage)
            }
            onHandleRowsPerPage={(rowsPerPage: number) =>
              setRowsPerPage(rowsPerPage)
            }
            stickyHeader={true}
            minHeight="300px"
            maxHeight="calc(100vh - 340px)"
            records={msgRecords}
            columnHeaders={msgColumnHeaders}
            paginate={true}
            emptyStateText={t('noMessagesToDisplay')}
            dataTotal={messageTotal}
            currentPage={currentPage}
            rowsPerPage={rowsPerPage}
          />
        </Grid>
      </Grid>
      {filterAnchor && (
        <FilterModal
          anchor={filterAnchor}
          onClose={() => {
            setFilterAnchor(null);
          }}
          fields={MessageFilters}
        />
      )}
      {viewMsg && (
        <MessageSlide
          message={viewMsg}
          open={!!viewMsg}
          onClose={() => {
            setViewMsg(undefined);
            addSlideToParams(undefined);
          }}
        />
      )}
    </>
  );
};
