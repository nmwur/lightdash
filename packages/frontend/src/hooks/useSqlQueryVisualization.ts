import {
    ApiQueryResults,
    ChartConfig,
    ChartType,
    CompiledDimension,
    CompiledMetric,
    CreateSavedChartVersion,
    DimensionType,
    Explore,
    fieldId,
    FieldId,
    FieldType,
    friendlyName,
    MetricType,
    SupportedDbtAdapter,
} from '@lightdash/common';
import { useMemo, useState } from 'react';
import { getValidChartConfig } from '../providers/ExplorerProvider';
import { useSqlQueryMutation } from './useSqlQuery';
import { SqlRunnerState } from './useSqlRunnerRoute';

const SQL_RESULTS_TABLE_NAME = 'sql_runner';

type Args = {
    initialState: SqlRunnerState['createSavedChart'];
    sqlQueryMutation: ReturnType<typeof useSqlQueryMutation>;
};

const useSqlQueryVisualization = ({
    initialState,
    sqlQueryMutation: { data },
}: Args) => {
    const fields = useMemo(
        () =>
            Object.entries(data?.fields || []).reduce<{
                sqlQueryDimensions: Record<FieldId, CompiledDimension>;
                sqlQueryMetrics: Record<FieldId, CompiledMetric>;
            }>(
                (acc, [key, { type }]) => {
                    if (type === DimensionType.NUMBER) {
                        const metric: CompiledMetric = {
                            isAutoGenerated: false,
                            fieldType: FieldType.METRIC,
                            type: MetricType.NUMBER,
                            name: key,
                            label: friendlyName(key),
                            table: SQL_RESULTS_TABLE_NAME,
                            tableLabel: '',
                            sql: '',
                            compiledSql: '',
                            tablesReferences: [SQL_RESULTS_TABLE_NAME],
                            hidden: false,
                        };
                        return {
                            ...acc,
                            sqlQueryMetrics: {
                                ...acc.sqlQueryMetrics,
                                [fieldId(metric)]: metric,
                            },
                        };
                    } else {
                        const dimension: CompiledDimension = {
                            fieldType: FieldType.DIMENSION,
                            type,
                            name: key,
                            label: friendlyName(key),
                            table: SQL_RESULTS_TABLE_NAME,
                            tableLabel: '',
                            sql: '',
                            compiledSql: '',
                            tablesReferences: [SQL_RESULTS_TABLE_NAME],
                            hidden: false,
                        };
                        return {
                            ...acc,
                            sqlQueryDimensions: {
                                ...acc.sqlQueryDimensions,
                                [fieldId(dimension)]: dimension,
                            },
                        };
                    }
                },
                { sqlQueryDimensions: {}, sqlQueryMetrics: {} },
            ),
        [data],
    );

    const [dimensionKeys, metricKeys]: [string[], string[]] = useMemo(() => {
        return [
            Object.keys(fields.sqlQueryDimensions),
            Object.keys(fields.sqlQueryMetrics),
        ];
    }, [fields]);

    const resultsData: ApiQueryResults | undefined = useMemo(
        () =>
            data?.rows
                ? {
                      metricQuery: {
                          dimensions: dimensionKeys,
                          metrics: metricKeys,
                          filters: {},
                          sorts: [],
                          limit: 0,
                          tableCalculations: [],
                      },
                      cacheMetadata: {
                          cacheHit: false,
                      },
                      rows: data.rows.map((row) =>
                          Object.keys(row).reduce((acc, columnName) => {
                              const raw = row[columnName];
                              return {
                                  ...acc,
                                  [`${SQL_RESULTS_TABLE_NAME}_${columnName}`]: {
                                      value: {
                                          raw,
                                          formatted: `${raw}`,
                                      },
                                  },
                              };
                          }, {}),
                      ),
                  }
                : undefined,
        [data, dimensionKeys, metricKeys],
    );
    const explore: Explore = useMemo(
        () => ({
            name: SQL_RESULTS_TABLE_NAME,
            label: '',
            tags: [],
            baseTable: SQL_RESULTS_TABLE_NAME,
            joinedTables: [],
            tables: {
                [SQL_RESULTS_TABLE_NAME]: {
                    name: SQL_RESULTS_TABLE_NAME,
                    label: '',
                    database: '',
                    schema: '',
                    sqlTable: '',
                    dimensions: fields.sqlQueryDimensions,
                    metrics: fields.sqlQueryMetrics,
                    lineageGraph: {},
                },
            },
            targetDatabase: SupportedDbtAdapter.POSTGRES,
        }),
        [fields],
    );

    const [chartType, setChartType] = useState<ChartType>(
        initialState?.chartConfig?.type || ChartType.CARTESIAN,
    );
    const [chartConfig, setChartConfig] = useState<ChartConfig['config']>(
        initialState?.chartConfig?.config,
    );
    const [pivotFields, setPivotFields] = useState<string[] | undefined>(
        initialState?.pivotConfig?.columns,
    );

    const createSavedChart: CreateSavedChartVersion | undefined = useMemo(
        () =>
            resultsData
                ? {
                      tableName: explore.name,
                      metricQuery: resultsData.metricQuery,
                      pivotConfig: pivotFields
                          ? {
                                columns: pivotFields,
                            }
                          : undefined,
                      chartConfig: getValidChartConfig(chartType, chartConfig),
                      tableConfig: {
                          columnOrder: [...dimensionKeys, ...metricKeys],
                      },
                  }
                : undefined,
        [
            chartConfig,
            chartType,
            dimensionKeys,
            metricKeys,
            explore.name,
            pivotFields,
            resultsData,
        ],
    );

    return {
        initialChartConfig: initialState?.chartConfig,
        initialPivotDimensions: initialState?.pivotConfig?.columns,
        explore,
        fieldsMap: { ...fields.sqlQueryDimensions, ...fields.sqlQueryMetrics },
        resultsData,
        chartType,
        columnOrder: [...dimensionKeys, ...metricKeys],
        createSavedChart,
        setChartType,
        setChartConfig,
        setPivotFields,
    };
};

export default useSqlQueryVisualization;
