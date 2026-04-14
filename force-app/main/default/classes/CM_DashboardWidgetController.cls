/**
 * @description  [영업포털-대시보드] 위젯 데이터 관리 Apex Controller
 * @author       Dashboard Team
 * @date         2026-03-06
 */
public with sharing class CM_DashboardWidgetController {

    // ============================================================
    // Inner Classes
    // ============================================================

    /**
     * @description 위젯 정보 DTO
     */
    public class WidgetDto {
        @AuraEnabled public String  widgetId        { get; set; }
        @AuraEnabled public String  widgetType      { get; set; } // TEXT, IMAGE, COMPONENT, REPORT, CHART, TABLE
        @AuraEnabled public String  title           { get; set; }
        @AuraEnabled public String  content         { get; set; }
        @AuraEnabled public String  componentName   { get; set; }
        @AuraEnabled public String  imageUrl        { get; set; }
        // REPORT
        @AuraEnabled public String  reportId        { get; set; }
        // CHART
        @AuraEnabled public String  chartSObject    { get; set; }
        @AuraEnabled public String  chartGroupBy    { get; set; }
        @AuraEnabled public String  chartValueField { get; set; }
        @AuraEnabled public String  chartAggregation{ get; set; } // COUNT | SUM | AVG
        @AuraEnabled public String  chartType       { get; set; } // bar | line | pie | doughnut
        // TABLE
        @AuraEnabled public String  tableSObject    { get; set; }
        @AuraEnabled public String  tableFields     { get; set; } // 콤마 구분 필드명
        @AuraEnabled public String  tableWhereClause{ get; set; }
        @AuraEnabled public String  tableOrderBy    { get; set; }
        @AuraEnabled public Integer tableLimit      { get; set; }
        // 공통
        @AuraEnabled public Integer colStart        { get; set; }
        @AuraEnabled public Integer rowStart        { get; set; }
        @AuraEnabled public Integer colSpan         { get; set; }
        @AuraEnabled public Integer rowSpan         { get; set; }
        @AuraEnabled public Integer sortOrder       { get; set; }
        @AuraEnabled public String  backgroundColor { get; set; }
        @AuraEnabled public String  textColor       { get; set; }
        @AuraEnabled public String  fontSize        { get; set; }
        @AuraEnabled public Boolean isBold          { get; set; }
        @AuraEnabled public Boolean isFixed         { get; set; }
    }

    /**
     * @description 대시보드 레이아웃 DTO
     */
    public class DashboardLayoutDto {
        @AuraEnabled public String      layoutId    { get; set; }
        @AuraEnabled public String      userId      { get; set; }
        @AuraEnabled public String      layoutName  { get; set; }
        @AuraEnabled public Integer     columns     { get; set; }
        @AuraEnabled public List<WidgetDto> widgets { get; set; }
    }

    // ============================================================
    // Apex Methods
    // ============================================================

    /**
     * @description 사용자 대시보드 레이아웃 조회
     */
    @AuraEnabled(cacheable=false)
    public static DashboardLayoutDto getUserDashboardLayout(String userId) {
        try {
            String targetUserId = String.isBlank(userId)
                ? UserInfo.getUserId()
                : userId;

            // CM_DashboardLayout__c 레코드 조회
            List<CM_DashboardLayout__c> layouts = [
                SELECT Id, Name, Columns__c, LayoutConfig__c, OwnerId
                FROM CM_DashboardLayout__c
                WHERE OwnerId = :targetUserId
                WITH SECURITY_ENFORCED
                ORDER BY CreatedDate DESC
                LIMIT 1
            ];

            DashboardLayoutDto dto = new DashboardLayoutDto();
            dto.userId   = targetUserId;
            dto.columns  = 12;
            dto.widgets  = new List<WidgetDto>();

            if (!layouts.isEmpty()) {
                CM_DashboardLayout__c layout = layouts[0];
                dto.layoutId   = layout.Id;
                dto.layoutName = layout.Name;
                dto.columns    = layout.Columns__c != null
                    ? Integer.valueOf(layout.Columns__c)
                    : 12;

                // JSON 직렬화된 위젯 목록 파싱
                if (String.isNotBlank(layout.LayoutConfig__c)) {
                    dto.widgets = (List<WidgetDto>) JSON.deserialize(
                        layout.LayoutConfig__c,
                        List<WidgetDto>.class
                    );
                }
            }

            return dto;

        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }

    /**
     * @description 대시보드 레이아웃 저장 (Upsert)
     */
    @AuraEnabled
    public static String saveDashboardLayout(String layoutJson) {
        try {
            DashboardLayoutDto dto = (DashboardLayoutDto) JSON.deserialize(
                layoutJson,
                DashboardLayoutDto.class
            );

            CM_DashboardLayout__c layout;

            // 기존 레이아웃 있으면 Update, 없으면 Insert
            if (String.isNotBlank(dto.layoutId)) {
                List<CM_DashboardLayout__c> existing = [
                    SELECT Id FROM CM_DashboardLayout__c
                    WHERE Id = :dto.layoutId
                    WITH SECURITY_ENFORCED
                    LIMIT 1
                ];
                layout = existing.isEmpty()
                    ? new CM_DashboardLayout__c()
                    : existing[0];
            } else {
                layout = new CM_DashboardLayout__c();
            }

            layout.Name           = String.isNotBlank(dto.layoutName)
                ? dto.layoutName
                : 'My Dashboard';
            layout.Columns__c     = dto.columns != null ? dto.columns : 12;
            layout.LayoutConfig__c = JSON.serialize(dto.widgets);

            if (String.isNotBlank(layout.Id)) {
                update layout; // CRUD check via WITH SECURITY_ENFORCED above
            } else {
                insert layout;
            }

            return layout.Id;

        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }

    /**
     * @description 사용 가능한 LWC 컴포넌트 목록 조회
     * (Custom Metadata 기반 관리)
     */
    @AuraEnabled(cacheable=true)
    public static List<Map<String, String>> getAvailableComponents() {
        try {
            List<Map<String, String>> components = new List<Map<String, String>>();

            List<CM_DashboardComponent__mdt> metas = [
                SELECT Label, DeveloperName, ComponentName__c, Description__c, Category__c
                FROM CM_DashboardComponent__mdt
                WHERE IsActive__c = true
                WITH SECURITY_ENFORCED
                ORDER BY SortOrder__c ASC NULLS LAST
            ];

            for (CM_DashboardComponent__mdt meta : metas) {
                Map<String, String> comp = new Map<String, String>{
                    'label'         => meta.Label,
                    'value'         => meta.ComponentName__c,
                    'description'   => meta.Description__c,
                    'category'      => meta.Category__c
                };
                components.add(comp);
            }

            return components;

        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }

    /**
     * @description CHART 위젯용 집계 데이터 조회
     *              sObject·필드를 Schema API로 검증 후 동적 SOQL 실행
     * @param sObjectName   - API명 (예: Account)
     * @param groupByField  - 그룹 기준 필드 (예: Industry)
     * @param valueField    - 집계 대상 필드 (COUNT 시 무시)
     * @param aggregation   - COUNT | SUM | AVG
     * @param whereClause   - WHERE 절 (선택, null 가능)
     * @return [{label, value}] 목록
     */
    @AuraEnabled(cacheable=true)
    public static List<Map<String, Object>> getChartData(
        String sObjectName,
        String groupByField,
        String valueField,
        String aggregation,
        String whereClause
    ) {
        try {
            // 입력값 검증
            if (String.isBlank(sObjectName) || String.isBlank(groupByField)) {
                return new List<Map<String, Object>>();
            }

            // sObject 존재 여부 확인
            Map<String, Schema.SObjectType> globalDescribe = Schema.getGlobalDescribe();
            String sobjectKey = sObjectName.toLowerCase();
            Schema.SObjectType sType = null;
            for (String k : globalDescribe.keySet()) {
                if (k.toLowerCase() == sobjectKey) {
                    sType = globalDescribe.get(k);
                    break;
                }
            }
            if (sType == null) {
                throw new IllegalArgumentException('유효하지 않은 오브젝트: ' + sObjectName);
            }

            Schema.DescribeSObjectResult sDescribe = sType.getDescribe();
            Map<String, Schema.SObjectField> fieldMap = sDescribe.fields.getMap();

            // groupByField 유효성 검증
            if (!fieldMap.containsKey(groupByField.toLowerCase())) {
                throw new IllegalArgumentException('유효하지 않은 그룹 필드: ' + groupByField);
            }

            // 집계 방식 결정
            String aggFunc = 'COUNT()';
            if (aggregation == 'SUM' && String.isNotBlank(valueField)) {
                if (!fieldMap.containsKey(valueField.toLowerCase())) {
                    throw new IllegalArgumentException('유효하지 않은 집계 필드: ' + valueField);
                }
                aggFunc = 'SUM(' + String.escapeSingleQuotes(valueField) + ')';
            } else if (aggregation == 'AVG' && String.isNotBlank(valueField)) {
                if (!fieldMap.containsKey(valueField.toLowerCase())) {
                    throw new IllegalArgumentException('유효하지 않은 집계 필드: ' + valueField);
                }
                aggFunc = 'AVG(' + String.escapeSingleQuotes(valueField) + ')';
            }

            String safeGroupBy = String.escapeSingleQuotes(groupByField);
            String safeSObject = String.escapeSingleQuotes(sObjectName);

            String soql = 'SELECT ' + safeGroupBy + ', ' + aggFunc
                + ' FROM ' + safeSObject;
            if (String.isNotBlank(whereClause)) {
                soql += ' WHERE ' + whereClause;
            }
            soql += ' GROUP BY ' + safeGroupBy
                + ' WITH USER_MODE'
                + ' ORDER BY ' + safeGroupBy
                + ' LIMIT 50';

            List<AggregateResult> results = Database.query(soql);
            List<Map<String, Object>> data = new List<Map<String, Object>>();

            for (AggregateResult ar : results) {
                Object labelVal = ar.get(groupByField);
                Object numVal   = ar.get('expr0');
                Map<String, Object> row = new Map<String, Object>{
                    'label' => labelVal != null ? String.valueOf(labelVal) : '(없음)',
                    'value' => numVal   != null ? numVal : 0
                };
                data.add(row);
            }

            return data;

        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }

    /**
     * @description TABLE 위젯용 레코드 데이터 조회
     *              sObject·필드를 Schema API로 검증 후 동적 SOQL 실행
     * @param sObjectName  - API명 (예: Contact)
     * @param fields       - 콤마 구분 필드명 (예: Name,Email,Phone)
     * @param whereClause  - WHERE 절 (선택, null 가능)
     * @param orderBy      - ORDER BY 절 (선택, null 가능)
     * @param limitRows    - 최대 행 수 (기본 50, 최대 200)
     * @return { columns: [{label, fieldName}], rows: [SObject as Map] }
     */
    @AuraEnabled(cacheable=true)
    public static Map<String, Object> getTableData(
        String sObjectName,
        String fields,
        String whereClause,
        String orderBy,
        Integer limitRows
    ) {
        try {
            if (String.isBlank(sObjectName) || String.isBlank(fields)) {
                return new Map<String, Object>{
                    'columns' => new List<Object>(),
                    'rows'    => new List<Object>()
                };
            }

            // sObject 존재 여부 확인
            Map<String, Schema.SObjectType> globalDescribe = Schema.getGlobalDescribe();
            String sobjectKey = sObjectName.toLowerCase();
            Schema.SObjectType sType = null;
            for (String k : globalDescribe.keySet()) {
                if (k.toLowerCase() == sobjectKey) {
                    sType = globalDescribe.get(k);
                    break;
                }
            }
            if (sType == null) {
                throw new AuraHandledException('유효하지 않은 오브젝트: ' + sObjectName);
            }

            Map<String, Schema.SObjectField> fieldMap = sType.getDescribe().fields.getMap();

            // 필드 유효성 검증 및 컬럼 메타 생성
            List<String> safeFields = new List<String>();
            List<Map<String, String>> columns = new List<Map<String, String>>();

            for (String f : fields.split(',')) {
                String trimmed = f.trim();
                if (String.isBlank(trimmed)) continue;
                if (!fieldMap.containsKey(trimmed.toLowerCase())) {
                    throw new AuraHandledException('유효하지 않은 필드: ' + trimmed);
                }
                safeFields.add(trimmed);
                Schema.DescribeFieldResult dfr = fieldMap.get(trimmed.toLowerCase()).getDescribe();
                columns.add(new Map<String, String>{
                    'label'     => dfr.getLabel(),
                    'fieldName' => trimmed
                });
            }

            if (safeFields.isEmpty()) {
                return new Map<String, Object>{
                    'columns' => columns,
                    'rows'    => new List<Object>()
                };
            }

            Integer rowLimit = (limitRows != null && limitRows > 0)
                ? Math.min(limitRows, 200)
                : 50;

            String safeSObject = String.escapeSingleQuotes(sObjectName);
            String soql = 'SELECT ' + String.join(safeFields, ', ')
                + ' FROM ' + safeSObject;
            if (String.isNotBlank(whereClause)) {
                soql += ' WHERE ' + whereClause;
            }
            if (String.isNotBlank(orderBy)) {
                soql += ' ORDER BY ' + orderBy;
            }
            soql += ' WITH USER_MODE LIMIT ' + rowLimit;

            List<SObject> records = Database.query(soql);

            // SObject → Map 변환 (LWC 직렬화 호환)
            List<Map<String, Object>> rows = new List<Map<String, Object>>();
            for (SObject rec : records) {
                Map<String, Object> row = new Map<String, Object>();
                for (String f : safeFields) {
                    row.put(f, rec.get(f));
                }
                rows.add(row);
            }

            return new Map<String, Object>{
                'columns' => columns,
                'rows'    => rows
            };

        } catch (AuraHandledException ahe) {
            throw ahe;
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }
}
