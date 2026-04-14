/**
 * @description  CM_DashboardWidgetController 테스트 클래스
 * @author       Dashboard Team
 * @date         2026-03-06
 */
@IsTest
private class CM_DashboardWidgetControllerTest {

    // ============================================================
    // Test Data Setup
    // ============================================================
    @TestSetup
    static void makeData() {
        // 테스트용 레이아웃 레코드 생성
        CM_DashboardLayout__c layout = new CM_DashboardLayout__c(
            Name         = 'Test Dashboard',
            Columns__c   = 12,
            LayoutConfig__c = JSON.serialize(getTestWidgets())
        );
        insert layout;
    }

    // ============================================================
    // Helper
    // ============================================================
    static List<CM_DashboardWidgetController.WidgetDto> getTestWidgets() {
        CM_DashboardWidgetController.WidgetDto w = new CM_DashboardWidgetController.WidgetDto();
        w.widgetId   = 'widget_001';
        w.widgetType = 'TEXT';
        w.title      = '테스트 위젯';
        w.content    = '테스트 내용';
        w.colStart   = 1;
        w.rowStart   = 1;
        w.colSpan    = 4;
        w.rowSpan    = 2;
        w.sortOrder  = 1;
        return new List<CM_DashboardWidgetController.WidgetDto>{ w };
    }

    // ============================================================
    // Positive Tests
    // ============================================================

    /**
     * @description 사용자 레이아웃 조회 - 레코드 존재시
     */
    @IsTest
    static void testGetUserDashboardLayout_Positive() {
        Test.startTest();
        CM_DashboardWidgetController.DashboardLayoutDto dto =
            CM_DashboardWidgetController.getUserDashboardLayout(null);
        Test.stopTest();

        System.assertNotEquals(null, dto, 'DTO가 null이 아니어야 합니다.');
        System.assertEquals(12, dto.columns, '기본 컬럼 수는 12여야 합니다.');
    }

    /**
     * @description 사용자 레이아웃 조회 - 레코드 없는 신규 사용자
     */
    @IsTest
    static void testGetUserDashboardLayout_NewUser() {
        // 다른 사용자 컨텍스트 시뮬레이션을 위해 빈 userId 전달
        Test.startTest();
        CM_DashboardWidgetController.DashboardLayoutDto dto =
            CM_DashboardWidgetController.getUserDashboardLayout(UserInfo.getUserId());
        Test.stopTest();

        System.assertNotEquals(null, dto, 'DTO가 null이 아니어야 합니다.');
        System.assertNotEquals(null, dto.widgets, '위젯 목록이 null이 아니어야 합니다.');
    }

    /**
     * @description 레이아웃 저장 - 신규 Insert
     */
    @IsTest
    static void testSaveDashboardLayout_Insert() {
        CM_DashboardWidgetController.DashboardLayoutDto dto =
            new CM_DashboardWidgetController.DashboardLayoutDto();
        dto.layoutName = 'New Dashboard';
        dto.columns    = 12;
        dto.widgets    = getTestWidgets();

        Test.startTest();
        String layoutId = CM_DashboardWidgetController.saveDashboardLayout(JSON.serialize(dto));
        Test.stopTest();

        System.assertNotEquals(null, layoutId, '레이아웃 ID가 반환되어야 합니다.');

        List<CM_DashboardLayout__c> saved = [
            SELECT Id, Name FROM CM_DashboardLayout__c WHERE Id = :layoutId
        ];
        System.assertEquals(1, saved.size(), '레이아웃이 저장되어야 합니다.');
        System.assertEquals('New Dashboard', saved[0].Name, '레이아웃 이름이 일치해야 합니다.');
    }

    /**
     * @description 레이아웃 저장 - 기존 Update
     */
    @IsTest
    static void testSaveDashboardLayout_Update() {
        CM_DashboardLayout__c existing = [
            SELECT Id, Name FROM CM_DashboardLayout__c LIMIT 1
        ];

        CM_DashboardWidgetController.DashboardLayoutDto dto =
            new CM_DashboardWidgetController.DashboardLayoutDto();
        dto.layoutId   = existing.Id;
        dto.layoutName = 'Updated Dashboard';
        dto.columns    = 12;
        dto.widgets    = getTestWidgets();

        Test.startTest();
        String layoutId = CM_DashboardWidgetController.saveDashboardLayout(JSON.serialize(dto));
        Test.stopTest();

        CM_DashboardLayout__c updated = [
            SELECT Id, Name FROM CM_DashboardLayout__c WHERE Id = :layoutId
        ];
        System.assertEquals('Updated Dashboard', updated.Name, '업데이트된 이름이 일치해야 합니다.');
    }

    // ============================================================
    // Negative Tests
    // ============================================================

    /**
     * @description 레이아웃 저장 - 잘못된 JSON
     */
    @IsTest
    static void testSaveDashboardLayout_InvalidJson() {
        Boolean exceptionThrown = false;
        try {
            Test.startTest();
            CM_DashboardWidgetController.saveDashboardLayout('INVALID_JSON');
            Test.stopTest();
        } catch (AuraHandledException e) {
            exceptionThrown = true;
        }
        System.assert(exceptionThrown, 'AuraHandledException이 발생해야 합니다.');
    }

    /**
     * @description 잘못된 userId로 조회
     */
    @IsTest
    static void testGetUserDashboardLayout_InvalidUserId() {
        Test.startTest();
        CM_DashboardWidgetController.DashboardLayoutDto dto =
            CM_DashboardWidgetController.getUserDashboardLayout('INVALID_ID');
        Test.stopTest();
        // 빈 결과여도 예외 없이 반환
        System.assertNotEquals(null, dto, 'DTO가 반환되어야 합니다.');
    }
}
