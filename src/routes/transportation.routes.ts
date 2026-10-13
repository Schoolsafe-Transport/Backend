import { Router } from 'express';
import { transportationController } from '../controllers/transportation.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();

// 1. Search and Route Discovery
router.get(
  '/search',
  authenticate,
  authorize('PARENT', 'ADMIN', 'SUPER_ADMIN'),
  transportationController.search.bind(transportationController)
);

router.get(
  '/routes/:id',
  authenticate,
  authorize('PARENT', 'TRANSPORT_PROVIDER', 'DRIVER', 'ADMIN', 'SUPER_ADMIN'),
  transportationController.getRouteDetails.bind(transportationController)
);

// 2. Student Management for Parents
router.get(
  '/students',
  authenticate,
  authorize('PARENT', 'ADMIN', 'SUPER_ADMIN'),
  transportationController.getStudents.bind(transportationController)
);

router.post(
  '/students',
  authenticate,
  authorize('PARENT', 'ADMIN', 'SUPER_ADMIN'),
  transportationController.createStudent.bind(transportationController)
);

// 3. Transportation Requests
router.post(
  '/requests',
  authenticate,
  authorize('PARENT', 'ADMIN', 'SUPER_ADMIN'),
  transportationController.createRequest.bind(transportationController)
);

router.get(
  '/requests',
  authenticate,
  authorize('PARENT', 'TRANSPORT_PROVIDER', 'DRIVER', 'ADMIN', 'SUPER_ADMIN'),
  transportationController.getRequests.bind(transportationController)
);

// Alias for provider explicit requests path
router.get(
  '/provider/requests',
  authenticate,
  authorize('TRANSPORT_PROVIDER', 'DRIVER', 'ADMIN', 'SUPER_ADMIN'),
  transportationController.getRequests.bind(transportationController)
);

router.get(
  '/requests/:id',
  authenticate,
  authorize('PARENT', 'TRANSPORT_PROVIDER', 'DRIVER', 'ADMIN', 'SUPER_ADMIN'),
  transportationController.getRequestById.bind(transportationController)
);

// 4. Price Negotiation
router.post(
  '/requests/:id/counter',
  authenticate,
  authorize('PARENT', 'TRANSPORT_PROVIDER', 'DRIVER', 'ADMIN', 'SUPER_ADMIN'),
  transportationController.counterOffer.bind(transportationController)
);

router.post(
  '/requests/:id/accept-offer',
  authenticate,
  authorize('PARENT', 'TRANSPORT_PROVIDER', 'DRIVER', 'ADMIN', 'SUPER_ADMIN'),
  transportationController.acceptOffer.bind(transportationController)
);

// 5. Provider Acceptance & Safe Seat Reservation
router.post(
  '/requests/:id/accept',
  authenticate,
  authorize('TRANSPORT_PROVIDER', 'DRIVER', 'ADMIN', 'SUPER_ADMIN'),
  transportationController.acceptRequest.bind(transportationController)
);

router.post(
  '/requests/:id/reject',
  authenticate,
  authorize('TRANSPORT_PROVIDER', 'DRIVER', 'ADMIN', 'SUPER_ADMIN'),
  transportationController.rejectRequest.bind(transportationController)
);

// 6. Agreements and Cancellation
router.get(
  '/my-agreements',
  authenticate,
  authorize('PARENT', 'ADMIN', 'SUPER_ADMIN'),
  transportationController.getMyAgreements.bind(transportationController)
);

// Alias for /agreements
router.get(
  '/agreements',
  authenticate,
  authorize('PARENT', 'ADMIN', 'SUPER_ADMIN'),
  transportationController.getMyAgreements.bind(transportationController)
);

router.post(
  '/agreements/:id/cancel',
  authenticate,
  authorize('PARENT', 'TRANSPORT_PROVIDER', 'DRIVER', 'ADMIN', 'SUPER_ADMIN'),
  transportationController.cancelAgreement.bind(transportationController)
);

router.post(
  '/agreements/:id/pay',
  authenticate,
  authorize('PARENT', 'ADMIN', 'SUPER_ADMIN'),
  transportationController.processPayment.bind(transportationController)
);

// 7. Active Passengers Manifest for Providers
router.get(
  '/passengers',
  authenticate,
  authorize('TRANSPORT_PROVIDER', 'DRIVER', 'ADMIN', 'SUPER_ADMIN'),
  transportationController.getActivePassengers.bind(transportationController)
);

// Alias for /provider/passengers
router.get(
  '/provider/passengers',
  authenticate,
  authorize('TRANSPORT_PROVIDER', 'DRIVER', 'ADMIN', 'SUPER_ADMIN'),
  transportationController.getActivePassengers.bind(transportationController)
);

export default router;
