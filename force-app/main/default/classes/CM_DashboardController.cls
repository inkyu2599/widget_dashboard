/**
 * @description [CM-대시보드] Apex 컨트롤러
 */
public with sharing class CM_DashboardController {

    // ── 권한 헬퍼 ────────────────────────────────────────────────────

    private static Boolean isDashboardAdmin() {
        return FeatureManagement.checkPermission('Dashboard_Admin');
    }

    @AuraEnabled
    public static Boolean isAdmin() {
        return isDashboardAdmin();
    }

    // ── 대시보드 CRUD ────────────────────────────────────────────────

    @AuraEnabled
    public static List<CM_Dashboard__c> getDashboards() {
        if (isDashboardAdmin()) {
            // 관리자: 전체 반환
            return [
                SELECT Id, Name, Description__c, IsActive__c, LastModifiedDate,
                       AudienceType__c, AudienceValue__c, Priority__c, LayoutConfig__c
                FROM   CM_Dashboard__c
                WITH   USER_MODE
                ORDER  BY LastModifiedDate DESC
                LIMIT  200
            ];
        }

        // 일반 사용자: Audience 매칭된 대시보드만 반환 (접근 제어는 Audience 필터링으로 처리)
        List<CM_Dashboard__c> candidates = [
            SELECT Id, Name, Description__c, IsActive__c, LastModifiedDate,
                   AudienceType__c, AudienceValue__c, Priority__c, LayoutConfig__c
            FROM   CM_Dashboard__c
            WHERE  IsActive__c = true
            WITH   SYSTEM_MODE
            ORDER  BY Priority__c ASC NULLS LAST, LastModifiedDate DESC
            LIMIT  200
        ];

        Id userId    = UserInfo.getUserId();
        Id profileId = UserInfo.getProfileId();

        Set<Id> memberGroupIds = new Set<Id>();
        for (GroupMember gm : [SELECT GroupId FROM GroupMember WHERE UserOrGroupId = :userId]) {
            memberGroupIds.add(gm.GroupId);
        }
        Set<String> userGroupDevNames = new Set<String>();
        if (!memberGroupIds.isEmpty()) {
            for (Group g : [SELECT DeveloperName FROM Group WHERE Id IN :memberGroupIds]) {
                userGroupDevNames.add(g.DeveloperName);
            }
        }

        List<CM_Dashboard__c> result = new List<CM_Dashboard__c>();
        for (CM_Dashboard__c d : candidates) {
            String  aType = d.AudienceType__c;
            String  aVal  = d.AudienceValue__c;
            Boolean match = false;

            if (aType == 'Default') {
                match = true;
            } else if (aType == 'Profile' && String.isNotBlank(aVal)) {
                match = (profileId == (Id) aVal);
            } else if (aType == 'CustomPermission' && String.isNotBlank(aVal)) {
                match = FeatureManagement.checkPermission(aVal);
            } else if (aType == 'Group' && String.isNotBlank(aVal)) {
                match = userGroupDevNames.contains(aVal);
            }

            if (match) result.add(d);
        }
        return result;
    }

    @AuraEnabled(cacheable=false)
    public static Map<String, Object> getDashboard(Id dashboardId) {
        List<CM_Dashboard__c> rows = [
            SELECT Id, Name, Description__c, IsActive__c, LayoutConfig__c,
                   AudienceType__c, AudienceValue__c, Priority__c
            FROM   CM_Dashboard__c
            WHERE  Id = :dashboardId
            WITH   SYSTEM_MODE
            LIMIT  1
        ];
        if (rows.isEmpty()) {
            throw new AuraHandledException('대시보드를 찾을 수 없습니다.');
        }
        CM_Dashboard__c dash = rows[0];

        // 개인 레이아웃 확인
        String personalLayout = null;
        String key = UserInfo.getUserId() + '_' + String.valueOf(dashboardId);
        List<CM_UserDashboardLayout__c> personal = [
            SELECT LayoutConfig__c FROM CM_UserDashboardLayout__c
            WHERE UserDashboardKey__c = :key WITH SYSTEM_MODE LIMIT 1
        ];
        if (!personal.isEmpty() && String.isNotBlank(personal[0].LayoutConfig__c)) {
            personalLayout = personal[0].LayoutConfig__c;
        }

        Map<String, Object> result = new Map<String, Object>{
            'Id'              => dash.Id,
            'Name'            => dash.Name,
            'Description__c'  => dash.Description__c,
            'IsActive__c'     => dash.IsActive__c,
            'LayoutConfig__c' => personalLayout != null ? personalLayout : dash.LayoutConfig__c,
            'BaseLayoutConfig__c' => dash.LayoutConfig__c,
            'HasPersonalLayout'   => personalLayout != null,
            'AudienceType__c' => dash.AudienceType__c,
            'AudienceValue__c'=> dash.AudienceValue__c,
            'Priority__c'     => dash.Priority__c
        };
        return result;
    }

    @AuraEnabled
    public static void savePersonalLayout(Id dashboardId, String layoutJson) {
        try {
            String key = UserInfo.getUserId() + '_' + String.valueOf(dashboardId);
            CM_UserDashboardLayout__c rec = new CM_UserDashboardLayout__c(
                UserDashboardKey__c = key,
                LayoutConfig__c     = layoutJson
            );
            upsert rec UserDashboardKey__c;
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }

    @AuraEnabled
    public static void resetPersonalLayout(Id dashboardId) {
        try {
            String key = UserInfo.getUserId() + '_' + String.valueOf(dashboardId);
            List<CM_UserDashboardLayout__c> rows = [
                SELECT Id FROM CM_UserDashboardLayout__c
                WHERE UserDashboardKey__c = :key WITH SYSTEM_MODE LIMIT 1
            ];
            if (!rows.isEmpty()) delete rows;
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }

    @AuraEnabled
    public static Id saveDashboard(String dashboardJson) {
        if (!isDashboardAdmin()) {
            throw new AuraHandledException('대시보드 관리 권한이 없습니다.');
        }
        try {
            Map<String, Object> data = (Map<String, Object>) JSON.deserializeUntyped(dashboardJson);
            CM_Dashboard__c record = new CM_Dashboard__c();

            if (data.containsKey('id') && data.get('id') != null) {
                record.Id = (Id) String.valueOf(data.get('id'));
            }
            record.Name             = String.valueOf(data.get('name'));
            record.Description__c   = data.containsKey('description')
                                        ? String.valueOf(data.get('description')) : '';
            record.IsActive__c      = data.containsKey('isActive')
                                        ? (Boolean) data.get('isActive') : true;
            record.LayoutConfig__c  = data.containsKey('layoutConfig')
                                        ? String.valueOf(data.get('layoutConfig')) : '{"widgets":[]}';
            record.AudienceType__c  = data.containsKey('audienceType') && data.get('audienceType') != null
                                        ? String.valueOf(data.get('audienceType')) : 'None';
            record.AudienceValue__c = data.containsKey('audienceValue')
                                        ? String.valueOf(data.get('audienceValue')) : null;
            record.Priority__c      = data.containsKey('priority') && data.get('priority') != null
                                        ? (Decimal) data.get('priority') : 99;

            upsert as user record;
            return record.Id;
        } catch (AuraHandledException e) {
            throw e;
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }

    @AuraEnabled
    public static void deleteDashboard(Id dashboardId) {
        if (!isDashboardAdmin()) {
            throw new AuraHandledException('대시보드 관리 권한이 없습니다.');
        }
        try {
            delete as user new CM_Dashboard__c(Id = dashboardId);
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }

    // ── 개인화 설정 ──────────────────────────────────────────────────

    @AuraEnabled
    public static void setPersonalDefault(Id dashboardId) {
        try {
            CM_DashboardPref__c pref = CM_DashboardPref__c.getInstance(UserInfo.getUserId());
            if (pref == null) {
                pref = new CM_DashboardPref__c(SetupOwnerId = UserInfo.getUserId());
            }
            pref.DefaultDashboardId__c = dashboardId != null ? String.valueOf(dashboardId) : null;
            upsert pref;
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }

    // ── 기본 대시보드 조회 (개인화 → Audience 매칭) ──────────────────

    @AuraEnabled(cacheable=true)
    public static Id getDefaultDashboard() {
        try {
            // 1순위: 개인화 설정
            CM_DashboardPref__c pref = CM_DashboardPref__c.getInstance(UserInfo.getUserId());
            if (pref != null && String.isNotBlank(pref.DefaultDashboardId__c)) {
                List<CM_Dashboard__c> check = [
                    SELECT Id FROM CM_Dashboard__c
                    WHERE  Id = :(Id) pref.DefaultDashboardId__c
                    AND    IsActive__c = true
                    WITH   SYSTEM_MODE
                    LIMIT  1
                ];
                if (!check.isEmpty()) return check[0].Id;
            }

            // 2순위: Audience 매칭
            List<CM_Dashboard__c> candidates = [
                SELECT Id, AudienceType__c, AudienceValue__c, Priority__c
                FROM   CM_Dashboard__c
                WHERE  IsActive__c = true
                AND    AudienceType__c != 'None'
                AND    AudienceType__c != null
                WITH   SYSTEM_MODE
                ORDER  BY Priority__c ASC NULLS LAST
                LIMIT  50
            ];
            if (candidates.isEmpty()) return null;

            Id userId    = UserInfo.getUserId();
            Id profileId = UserInfo.getProfileId();

            Set<Id> memberGroupIds = new Set<Id>();
            for (GroupMember gm : [SELECT GroupId FROM GroupMember WHERE UserOrGroupId = :userId]) {
                memberGroupIds.add(gm.GroupId);
            }
            Set<String> userGroupDevNames = new Set<String>();
            if (!memberGroupIds.isEmpty()) {
                for (Group g : [SELECT DeveloperName FROM Group WHERE Id IN :memberGroupIds]) {
                    userGroupDevNames.add(g.DeveloperName);
                }
            }

            Map<String, Integer> typeOrder = new Map<String, Integer>{
                'CustomPermission' => 1,
                'Group'            => 2,
                'Profile'          => 3,
                'Default'          => 4
            };

            CM_Dashboard__c best      = null;
            Integer         bestOrder = 999;
            Decimal         bestPrio  = 9999;

            for (CM_Dashboard__c d : candidates) {
                String  aType = d.AudienceType__c;
                String  aVal  = d.AudienceValue__c;
                Boolean match = false;

                if (aType == 'Default') {
                    match = true;
                } else if (aType == 'Profile' && String.isNotBlank(aVal)) {
                    match = (profileId == (Id) aVal);
                } else if (aType == 'CustomPermission' && String.isNotBlank(aVal)) {
                    match = FeatureManagement.checkPermission(aVal);
                } else if (aType == 'Group' && String.isNotBlank(aVal)) {
                    match = userGroupDevNames.contains(aVal);
                }

                if (!match) continue;

                Integer order = typeOrder.containsKey(aType) ? typeOrder.get(aType) : 99;
                Decimal prio  = d.Priority__c != null ? d.Priority__c : 99;

                if (order < bestOrder || (order == bestOrder && prio < bestPrio)) {
                    best      = d;
                    bestOrder = order;
                    bestPrio  = prio;
                }
            }

            return best != null ? best.Id : null;
        } catch (Exception e) {
            return null;
        }
    }

    // ── Audience 선택용 목록 메서드 ─────────────────────────────────

    @AuraEnabled(cacheable=true)
    public static List<Map<String, String>> getProfiles() {
        List<Map<String, String>> result = new List<Map<String, String>>();
        for (Profile p : [SELECT Id, Name FROM Profile WITH USER_MODE ORDER BY Name LIMIT 200]) {
            result.add(new Map<String, String>{ 'label' => p.Name, 'value' => p.Id });
        }
        return result;
    }

    @AuraEnabled(cacheable=true)
    public static List<Map<String, String>> getPublicGroups() {
        List<Map<String, String>> result = new List<Map<String, String>>();
        for (Group g : [SELECT Id, DeveloperName, Name FROM Group
                        WHERE Type = 'Regular' WITH USER_MODE ORDER BY Name LIMIT 200]) {
            result.add(new Map<String, String>{
                'label' => g.Name, 'value' => g.DeveloperName
            });
        }
        return result;
    }

    @AuraEnabled(cacheable=true)
    public static List<Map<String, String>> getCustomPermissions() {
        List<Map<String, String>> result = new List<Map<String, String>>();
        for (CustomPermission cp : [SELECT DeveloperName, MasterLabel
                                    FROM CustomPermission
                                    WITH USER_MODE ORDER BY MasterLabel LIMIT 200]) {
            result.add(new Map<String, String>{
                'label' => cp.MasterLabel, 'value' => cp.DeveloperName
            });
        }
        return result;
    }

    // ── SObject 화이트리스트 ──────────────────────────────────────────

    @AuraEnabled(cacheable=false)
    public static List<Map<String, Object>> getAvailableSObjects(String widgetType) {
        List<Map<String, Object>> result = new List<Map<String, Object>>();
        for (CM_DashboardSObjectConfig__mdt cfg : [
            SELECT SObjectApiName__c, Label__c, AllowChart__c, AllowTable__c,
                   AllowedAggregations__c
            FROM   CM_DashboardSObjectConfig__mdt
            WHERE  IsActive__c != false
            ORDER  BY SortOrder__c ASC NULLS LAST, Label__c ASC
        ]) {
            if (String.isBlank(cfg.SObjectApiName__c)) continue;
            Boolean allowed = widgetType == 'TABLE' ? cfg.AllowTable__c != false : cfg.AllowChart__c != false;
            if (!allowed) continue;
            result.add(new Map<String, Object>{
                'apiName'             => cfg.SObjectApiName__c,
                'label'               => String.isNotBlank(cfg.Label__c) ? cfg.Label__c : cfg.SObjectApiName__c,
                'allowedAggregations' => cfg.AllowedAggregations__c
            });
        }
        return result;
    }

    private static Set<String> getAllowedSObjects(String widgetType) {
        Set<String> names = new Set<String>();
        for (CM_DashboardSObjectConfig__mdt cfg : [
            SELECT SObjectApiName__c, AllowChart__c, AllowTable__c
            FROM   CM_DashboardSObjectConfig__mdt
            WHERE  IsActive__c != false
        ]) {
            if (String.isBlank(cfg.SObjectApiName__c)) continue;
            Boolean allowed = widgetType == 'TABLE' ? cfg.AllowTable__c != false : cfg.AllowChart__c != false;
            if (allowed) names.add(cfg.SObjectApiName__c.toLowerCase());
        }
        return names;
    }

    // ── 커스텀 컴포넌트 목록 ─────────────────────────────────────────

    @AuraEnabled(cacheable=true)
    public static List<CM_DashboardComponent__mdt> getAvailableComponents() {
        return [
            SELECT DeveloperName, MasterLabel, ComponentName__c,
                   Category__c, Description__c, SortOrder__c
            FROM   CM_DashboardComponent__mdt
            WHERE  IsActive__c = true
            ORDER  BY SortOrder__c ASC NULLS LAST, MasterLabel ASC
        ];
    }

    // ── CHART 위젯 데이터 ────────────────────────────────────────────

    @AuraEnabled(cacheable=true)
    public static List<Map<String, Object>> getChartData(
        String sObjectName, String groupByField,
        String valueField,  String aggregation, String whereClause
    ) {
        try {
            if (String.isBlank(sObjectName) || String.isBlank(groupByField)) {
                return new List<Map<String, Object>>();
            }
            if (!getAllowedSObjects('CHART').contains(sObjectName.toLowerCase())) {
                throw new IllegalArgumentException('허용되지 않은 오브젝트: ' + sObjectName);
            }
            Map<String, Schema.SObjectType> globalDescribe = Schema.getGlobalDescribe();
            if (!globalDescribe.containsKey(sObjectName.toLowerCase())) {
                throw new IllegalArgumentException('유효하지 않은 오브젝트: ' + sObjectName);
            }
            Schema.DescribeSObjectResult sDescribe =
                globalDescribe.get(sObjectName.toLowerCase()).getDescribe();
            Map<String, Schema.SObjectField> fieldMap = sDescribe.fields.getMap();

            if (!fieldMap.containsKey(groupByField.toLowerCase())) {
                throw new IllegalArgumentException('유효하지 않은 그룹 필드: ' + groupByField);
            }

            String aggFunc = 'COUNT(Id)';
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
            if (String.isNotBlank(whereClause)) soql += ' WHERE ' + whereClause;
            soql += ' WITH USER_MODE GROUP BY ' + safeGroupBy
                  + ' ORDER BY ' + safeGroupBy + ' LIMIT 50';

            List<Map<String, Object>> data = new List<Map<String, Object>>();
            for (AggregateResult ar : (List<AggregateResult>) Database.query(soql)) {
                Object labelVal = ar.get(groupByField);
                Object numVal   = ar.get('expr0');
                data.add(new Map<String, Object>{
                    'label' => labelVal != null ? String.valueOf(labelVal) : '(없음)',
                    'value' => numVal   != null ? numVal : 0
                });
            }
            return data;
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }

    // ── TABLE 위젯 데이터 ────────────────────────────────────────────

    @AuraEnabled(cacheable=true)
    public static Map<String, Object> getTableData(
        String sObjectName, String fields,
        String whereClause, String orderBy, Integer limitRows
    ) {
        try {
            if (String.isBlank(sObjectName) || String.isBlank(fields)) {
                return new Map<String, Object>{
                    'columns' => new List<Object>(), 'rows' => new List<Object>()
                };
            }
            return CM_DashboardQueryHelper.queryTable(
                sObjectName, fields, whereClause, orderBy, limitRows
            );
        } catch (AuraHandledException e) {
            throw e;
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }
}
