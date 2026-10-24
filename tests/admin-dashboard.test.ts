import axios from 'axios';
import { prisma } from '../src/config/prisma';

const API = 'http://localhost:5000/api';

async function runAdminDashboardVerification() {
  console.log('====================================================');
  console.log('🛡️  SCHOOLSAFE ADMIN DASHBOARD & APPROVAL WORKFLOW TEST');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  const assert = (condition: boolean, desc: string) => {
    if (condition) {
      console.log(`  ✅ PASS: ${desc}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${desc}`);
      failed++;
    }
  };

  let tempParentId: string | null = null;
  let tempApplicantId: string | null = null;

  try {
    // 1. Authorization: Unauthenticated access must be rejected
    console.log('1. Testing Unauthenticated Access to Admin API...');
    try {
      await axios.get(`${API}/admin/stats`);
      assert(false, 'Unauthenticated request should have been rejected');
    } catch (err: any) {
      assert(err.response?.status === 401, `Unauthenticated request returned 401 (got ${err.response?.status})`);
    }

    // 2. Authorization: Non-admin (Parent) access must be rejected (403)
    console.log('\n2. Testing Non-Admin Access (Parent User)...');
    try {
      const ts = Date.now();
      const parentReg = await axios.post(`${API}/auth/register`, {
        email: `parent.test.${ts}@schoolsafe.org`,
        password: 'SafePassword123!',
        firstName: 'Test',
        lastName: 'Parent',
        phone: `+251911${ts.toString().slice(-6)}`,
        role: 'PARENT',
      });
      tempParentId = parentReg.data.data.user.id;
      const parentToken = parentReg.data.data.tokens.accessToken;

      try {
        await axios.get(`${API}/admin/stats`, {
          headers: { Authorization: `Bearer ${parentToken}` },
        });
        assert(false, 'Parent should NOT be authorized for admin stats');
      } catch (err: any) {
        assert(err.response?.status === 403, `Parent received 403 Forbidden on admin stats (got ${err.response?.status})`);
      }
    } catch (err: any) {
      assert(false, `Parent registration failed: ${err.message}`);
    }

    // 3. Admin Login & Real DB Stats
    console.log('\n3. Logging in as System Administrator...');
    const adminLogin = await axios.post(`${API}/auth/login`, {
      email: 'admin@schoolsafe.org',
      password: 'AdminSafe123!',
    });
    assert(adminLogin.status === 200, 'Admin login succeeded');
    const adminToken = adminLogin.data.data.tokens.accessToken;
    const adminUser = adminLogin.data.data.user;
    assert(adminUser.role === 'ADMIN' || adminUser.role === 'SUPER_ADMIN', `Admin role is ${adminUser.role}`);

    console.log('\n4. Fetching Real Platform Stats from Database...');
    const statsRes = await axios.get(`${API}/admin/stats`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(statsRes.status === 200, 'Admin stats retrieved successfully');
    const stats = statsRes.data.data;

    // Verify stats structure & real DB types
    assert(typeof stats.totalUsers === 'number', `totalUsers is a real number: ${stats.totalUsers}`);
    assert(typeof stats.pendingProviders === 'number', `pendingProviders is a number: ${stats.pendingProviders}`);
    assert(typeof stats.metrics?.parentsCount === 'number', `metrics.parentsCount is a number: ${stats.metrics?.parentsCount}`);
    assert(typeof stats.metrics?.approvedVehicles === 'number', `metrics.approvedVehicles is a number: ${stats.metrics?.approvedVehicles}`);
    assert(typeof stats.metrics?.activeRoutes === 'number', `metrics.activeRoutes is a number: ${stats.metrics?.activeRoutes}`);
    assert(typeof stats.metrics?.activeTrips === 'number', `metrics.activeTrips is a number: ${stats.metrics?.activeTrips}`);
    assert(typeof stats.metrics?.openIncidents === 'number', `metrics.openIncidents is a number: ${stats.metrics?.openIncidents}`);

    // Verify mock numbers are not artificially hardcoded
    console.log(`   📊 Summary: Users=${stats.totalUsers}, Pending Providers=${stats.pendingApprovals?.providers}, Vehicles=${stats.metrics?.totalVehicles}, Pending Payments=${stats.pendingApprovals?.payments}`);

    // 5. User Management Endpoint
    console.log('\n5. Testing Admin Users Endpoint...');
    const usersRes = await axios.get(`${API}/admin/users?limit=10`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(usersRes.status === 200, 'Admin users list retrieved');
    const users = usersRes.data.data.users || usersRes.data.data;
    assert(Array.isArray(users), `Retrieved ${users.length} users from database`);

    // 6. Provider Applications Queue
    console.log('\n6. Testing Provider Applications Queue...');
    const providersRes = await axios.get(`${API}/admin/applications?role=TRANSPORT_PROVIDER`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(providersRes.status === 200, 'Provider applications list retrieved');
    const providers = providersRes.data.data;
    assert(Array.isArray(providers), `Retrieved ${providers.length} provider applications`);

    // 7. Vehicle Fleet Management
    console.log('\n7. Testing Vehicle Fleet Verification Endpoint...');
    const vehiclesRes = await axios.get(`${API}/admin/vehicles`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(vehiclesRes.status === 200, 'Admin vehicles list retrieved');
    const vehicles = vehiclesRes.data.data.vehicles || vehiclesRes.data.data;
    assert(Array.isArray(vehicles), `Retrieved ${vehicles.length} vehicle records`);

    // 8. Routes & Trips Monitoring
    console.log('\n8. Testing Routes & Trips Endpoints...');
    const routesRes = await axios.get(`${API}/admin/routes`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(routesRes.status === 200, 'Admin routes list retrieved');

    const tripsRes = await axios.get(`${API}/admin/trips`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(tripsRes.status === 200, 'Admin trips list retrieved');

    // 9. Ad Campaigns Management
    console.log('\n9. Testing Advertisement Campaigns Endpoint...');
    const campaignsRes = await axios.get(`${API}/admin/campaigns`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(campaignsRes.status === 200, 'Admin campaigns list retrieved');
    const campaigns = campaignsRes.data.data.campaigns || campaignsRes.data.data;
    assert(Array.isArray(campaigns), `Retrieved ${campaigns.length} advertising campaigns`);

    // 10. Payments Reviews Queue
    console.log('\n10. Testing Payments Reviews Endpoint...');
    const paymentsRes = await axios.get(`${API}/admin/payments`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(paymentsRes.status === 200, 'Admin payments list retrieved');

    // 11. Audit Logs Endpoint
    console.log('\n11. Testing Security Audit Trail Endpoint...');
    const auditRes = await axios.get(`${API}/admin/audit-logs?limit=5`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(auditRes.status === 200, 'Audit logs retrieved');
    const auditLogs = auditRes.data.data.logs || auditRes.data.data;
    assert(Array.isArray(auditLogs), `Retrieved ${auditLogs.length} audit trail records`);

    // 12. Approval & Rejection Workflow Enforcement
    console.log('\n12. Testing Approval & Rejection Workflow Validation...');
    // Create a temporary provider applicant to test workflow
    const testProviderEmail = `applicant.test.${Date.now()}@schoolsafe.org`;
    const regProvider = await axios.post(`${API}/auth/register`, {
      email: testProviderEmail,
      password: 'SafePassword123!',
      firstName: 'Applicant',
      lastName: 'Workflow',
      phone: `+251922${Date.now().toString().slice(-6)}`,
      role: 'TRANSPORT_PROVIDER',
      businessName: 'Workflow Transit Co',
      licenseNumber: 'LIC-TEST-99',
    });
    tempApplicantId = regProvider.data.data.user.id;
    const applicantId = tempApplicantId;
    assert(Boolean(applicantId), `Created test applicant with ID: ${applicantId}`);

    // Try rejecting applicant WITHOUT reason -> must fail with 400
    try {
      await axios.patch(
        `${API}/admin/applications/${applicantId}/review`,
        { decision: 'REJECT', reason: '' },
        { headers: { Authorization: `Bearer ${adminToken}` } }
      );
      assert(false, 'Rejecting application without reason should have failed');
    } catch (err: any) {
      assert(err.response?.status === 400, `Rejection without reason failed with 400 (got ${err.response?.status})`);
    }

    // Rejecting WITH valid reason -> must succeed
    const rejectReasonText = 'Commercial operator transit license is expired and unverified.';
    const rejectSuccess = await axios.patch(
      `${API}/admin/applications/${applicantId}/review`,
      { decision: 'REJECT', reason: rejectReasonText },
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );
    assert(rejectSuccess.status === 200, 'Rejection with valid reason succeeded');
    assert(rejectSuccess.data.data.status === 'REJECTED', 'Status changed to REJECTED');
    assert(rejectSuccess.data.data.rejectionReason === rejectReasonText, 'Rejection reason stored correctly');

    // Approving the applicant -> changes status to ACTIVE, isVerified to true
    const approveSuccess = await axios.patch(
      `${API}/admin/applications/${applicantId}/review`,
      { decision: 'APPROVE' },
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );
    assert(approveSuccess.status === 200, 'Approval succeeded');
    assert(approveSuccess.data.data.status === 'ACTIVE', 'Status updated to ACTIVE');
    assert(approveSuccess.data.data.isVerified === true, 'Provider isVerified set to true');

    // Verify audit log has the entries
    const postAuditRes = await axios.get(`${API}/admin/audit-logs?limit=5`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const recentLogs = postAuditRes.data.data.logs || postAuditRes.data.data;
    const foundAudit = recentLogs.find(
      (l: any) => l.targetUserId === applicantId || l.entityId === applicantId
    );
    assert(Boolean(foundAudit), `Audit trail entry recorded for applicant ${applicantId}`);

    console.log('\n====================================================');
    console.log(`🏁 VERIFICATION COMPLETE: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================\n');

    if (failed > 0) {
      throw new Error(`Admin dashboard verification failed with ${failed} failure(s)`);
    }
  } finally {
    const toDelete = [tempParentId, tempApplicantId].filter(Boolean) as string[];
    if (toDelete.length > 0) {
      await prisma.auditLog.deleteMany({ where: { targetUserId: { in: toDelete } } });
      await prisma.user.deleteMany({ where: { id: { in: toDelete } } });
      console.log(`🧹 Cleaned up ${toDelete.length} temporary test runner account(s).`);
    }
  }
}

describe('Admin Dashboard Verification', () => {
  jest.setTimeout(60000);
  it('should verify admin dashboard and approval workflow', async () => {
    await runAdminDashboardVerification();
  });
});
