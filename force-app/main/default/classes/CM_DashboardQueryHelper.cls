/**
 * @description [CM-대시보드] 공통 SOQL 유틸리티
 *              부서 개발자가 보안 검증 없이 안전하게 SOQL을 실행할 수 있도록 지원
 */
public with sharing class CM_DashboardQueryHelper {

    // SObject 화이트리스트 (트랜잭션 내 캐시)
    private static Set<String> allowedSObjectCache = null;

    // ── 검증 ──────────────────────────────────────────────────────────

    /**
     * CM_DashboardSObjectConfig__mdt 화이트리스트에 등록된 SObject인지 확인
     */
    public static Boolean validateSObject(String apiName) {
        if (String.isBlank(apiName)) return false;
        if (allowedSObjectCache == null) {
            allowedSObjectCache = new Set<String>();
            for (CM_DashboardSObjectConfig__mdt cfg : [
                SELECT SObjectApiName__c FROM CM_DashboardSObjectConfig__mdt
                WHERE IsActive__c != false
            ]) {
                if (String.isNotBlank(cfg.SObjectApiName__c))
                    allowedSObjectCache.add(cfg.SObjectApiName__c.toLowerCase());
            }
        }
        return allowedSObjectCache.contains(apiName.toLowerCase());
    }

    /**
     * SObject에 실제로 존재하는 필드만 반환 (없는 필드 제거)
     */
    public static List<String> validateFields(String sObjectName, List<String> fieldList) {
        Schema.SObjectType sType = Schema.getGlobalDescribe().get(sObjectName.toLowerCase());
        if (sType == null) return new List<String>();
        Map<String, Schema.SObjectField> fieldMap = sType.getDescribe().fields.getMap();
        List<String> valid = new List<String>();
        for (String f : fieldList) {
            if (String.isNotBlank(f) && fieldMap.containsKey(f.trim().toLowerCase()))
                valid.add(f.trim());
        }
        return valid;
    }

    // ── 쿼리 실행 ─────────────────────────────────────────────────────

    /**
     * 테이블용 범용 쿼리. lightning-datatable에 바로 쓸 수 있는 { columns, rows } 반환.
     *
     * @param sObjectName  SObject API명 (화이트리스트 검증)
     * @param fields       쉼표 구분 필드 목록 (예: "Name,Amount,StageName")
     * @param whereClause  WHERE 조건 (null/blank 가능)
     * @param orderBy      ORDER BY 절 (null/blank 가능)
     * @param limitRows    최대 행 수 (최대 200)
     */
    public static Map<String, Object> queryTable(
        String sObjectName, String fields,
        String whereClause, String orderBy, Integer limitRows
    ) {
        if (!validateSObject(sObjectName))
            throw new AuraHandledException('허용되지 않은 오브젝트: ' + sObjectName);

        List<String> fieldList  = fields.replaceAll('\\s', '').split(',');
        List<String> safeFields = validateFields(sObjectName, fieldList);
        if (safeFields.isEmpty())
            return new Map<String, Object>{
                'columns' => new List<Object>(), 'rows' => new List<Object>()
            };

        Map<String, Schema.SObjectField> fieldMap =
            Schema.getGlobalDescribe().get(sObjectName.toLowerCase())
                  .getDescribe().fields.getMap();

        List<Map<String, String>> columns = new List<Map<String, String>>();
        for (String f : safeFields) {
            columns.add(new Map<String, String>{
                'fieldName' => f,
                'label'     => fieldMap.get(f.toLowerCase()).getDescribe().getLabel()
            });
        }

        String soql = buildSoql(sObjectName, safeFields, whereClause, orderBy, limitRows);
        List<Map<String, Object>> rows = new List<Map<String, Object>>();
        for (SObject rec : Database.query(soql)) {
            Map<String, Object> row = new Map<String, Object>();
            for (String f : safeFields) row.put(f, rec.get(f));
            rows.add(row);
        }
        return new Map<String, Object>{ 'columns' => columns, 'rows' => rows };
    }

    /**
     * SObject 레코드 목록 반환. 부서 컴포넌트에서 커스텀 렌더링이 필요할 때 사용.
     */
    public static List<SObject> queryList(
        String sObjectName, String fields,
        String whereClause, String orderBy, Integer limitRows
    ) {
        if (!validateSObject(sObjectName))
            throw new AuraHandledException('허용되지 않은 오브젝트: ' + sObjectName);

        List<String> fieldList  = fields.replaceAll('\\s', '').split(',');
        List<String> safeFields = validateFields(sObjectName, fieldList);
        if (safeFields.isEmpty()) return new List<SObject>();

        return Database.query(buildSoql(sObjectName, safeFields, whereClause, orderBy, limitRows));
    }

    // ── 내부 헬퍼 ─────────────────────────────────────────────────────

    private static String buildSoql(
        String sObjectName, List<String> safeFields,
        String whereClause, String orderBy, Integer limitRows
    ) {
        Integer rowLimit = (limitRows != null && limitRows > 0) ? Math.min(limitRows, 200) : 50;
        String soql = 'SELECT ' + String.join(safeFields, ', ')
            + ' FROM ' + String.escapeSingleQuotes(sObjectName);
        if (String.isNotBlank(whereClause)) soql += ' WHERE ' + whereClause;
        soql += ' WITH USER_MODE';
        if (String.isNotBlank(orderBy)) soql += ' ORDER BY ' + orderBy;
        soql += ' LIMIT ' + rowLimit;
        return soql;
    }
}
