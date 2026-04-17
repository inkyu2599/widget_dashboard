/**
 * @description CM_DashboardController 테스트 클래스
 */
@IsTest
private class CM_DashboardControllerTest {

    @TestSetup
    static void setup() {
        CM_Dashboard__c dash = new CM_Dashboard__c(
            Name            = 'Test Dashboard',
            Description__c  = 'Test',
            IsActive__c     = true,
            LayoutConfig__c = '{"rows":[]}'
        );
        insert dash;
    }

    @IsTest
    static void testGetDashboards() {
        List<CM_Dashboard__c> result = CM_DashboardController.getDashboards();
        Assert.isTrue(result.size() >= 1, 'getDashboards should return at least 1 record');
    }

    @IsTest
    static void testGetDashboard() {
        CM_Dashboard__c created = [SELECT Id FROM CM_Dashboard__c LIMIT 1];
        CM_Dashboard__c result = CM_DashboardController.getDashboard(created.Id);
        Assert.areEqual('Test Dashboard', result.Name);
    }

    @IsTest
    static void testSaveDashboardInsert() {
        String json = '{"name":"New Dashboard","description":"Desc","isActive":true,"layoutConfig":"{\"rows\":[]}"}';
        Id newId = CM_DashboardController.saveDashboard(json);
        Assert.isNotNull(newId, 'saveDashboard insert should return new Id');
    }

    @IsTest
    static void testSaveDashboardUpdate() {
        CM_Dashboard__c created = [SELECT Id FROM CM_Dashboard__c LIMIT 1];
        String json = '{"id":"' + created.Id + '","name":"Updated","isActive":true,"layoutConfig":"{\"rows\":[]}"}';
        Id updatedId = CM_DashboardController.saveDashboard(json);
        Assert.areEqual(created.Id, updatedId);
    }

    @IsTest
    static void testDeleteDashboard() {
        CM_Dashboard__c created = [SELECT Id FROM CM_Dashboard__c LIMIT 1];
        CM_DashboardController.deleteDashboard(created.Id);
        List<CM_Dashboard__c> remaining = [SELECT Id FROM CM_Dashboard__c WHERE Id = :created.Id];
        Assert.isTrue(remaining.isEmpty(), 'Record should be deleted');
    }

    @IsTest
    static void testGetChartDataEmpty() {
        List<Map<String, Object>> result = CM_DashboardController.getChartData('', '', '', 'COUNT', '');
        Assert.isTrue(result.isEmpty(), 'Empty params should return empty list');
    }

    @IsTest
    static void testGetChartDataCount() {
        List<Map<String, Object>> result = CM_DashboardController.getChartData(
            'Account', 'Industry', '', 'COUNT', '');
        Assert.isNotNull(result);
    }

    @IsTest
    static void testGetTableDataEmpty() {
        Map<String, Object> result = CM_DashboardController.getTableData('', '', '', '', 10);
        Assert.isNotNull(result);
    }

    @IsTest
    static void testGetTableData() {
        Map<String, Object> result = CM_DashboardController.getTableData(
            'Account', 'Name,Industry', '', 'Name ASC', 5);
        Assert.isTrue(result.containsKey('columns'));
        Assert.isTrue(result.containsKey('rows'));
    }
}
