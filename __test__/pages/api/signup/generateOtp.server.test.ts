import httpMocks from "node-mocks-http";
import { createOtpHandler } from "../../../../pages/api/signup/generateOtp";
import { dbConnectWrapper } from "@/lib/dbConnectWrapper";
import {
  isUserEmailTaken,
  validateGenerateOtpInput,
} from "../../../../lib/userLib";
import { createOtp, sendOtpEmail } from "../../../../lib/otpLib";
import { responseFormatter } from "../../../../lib/responseLib";
import { dbConnect } from "../../../../lib/mongoClient";

jest.mock("../../../../lib/userLib", () => {
  const original = jest.requireActual("../../../../lib/userLib"); // Step 2.
  return {
    ...original,
    __esModule: true,
    isUserEmailTaken: jest.fn(),
    validateGenerateOtpInput: jest.fn(),
  };
});

jest.mock("../../../../lib/otpLib", () => {
  const original = jest.requireActual("../../../../lib/otpLib"); // Step 2.
  return {
    ...original,
    __esModule: true,
    createOtp: jest.fn(),
    sendOtpEmail: jest.fn(),
  };
});
jest.mock("../../../../lib/mongoClient", () => {
  const original = jest.requireActual("../../../../lib/mongoClient");
  return {
    ...original,
    __esModule: true,
    dbConnect: jest.fn(),
  };
});
describe("POST /api/signup/generateOtp", () => {
  beforeEach(() => {});
  afterEach(() => {
    jest.resetAllMocks();
  });
  it("should return 405 method not allowed error when any method other than POST is used", async () => {
    isUserEmailTaken.mockResolvedValueOnce(false);
    // mock return value of validation function to be false
    validateGenerateOtpInput.mockReturnValueOnce({
      success: true,
    });

    const req = httpMocks.createRequest({
      method: "GET",
    });
    const res = httpMocks.createResponse();
    await createOtpHandler(req, res);
    expect(res.statusCode).toEqual(405);
    const responseBody = JSON.parse(res._getData());
    expect(responseBody.errorMessage).toContain("Method Not Allowed");
  });
  it("should return 400 BAD REQUEST response if email is already taken", async () => {
    isUserEmailTaken.mockResolvedValueOnce(true);
    validateGenerateOtpInput.mockReturnValueOnce({
      success: true,
    });
    const req = httpMocks.createRequest({
      method: "POST",
      url: "/api/signup/createOtp",
      body: { email: "email@email.com" },
    });
    const res = httpMocks.createResponse();
    await createOtpHandler(req, res);
    expect(res.statusCode).toEqual(400);
    const responseBody = JSON.parse(res._getData());
    expect(responseBody.success).toBe(false);
    expect(validateGenerateOtpInput).toBeCalledTimes(1);
    expect(isUserEmailTaken).toBeCalledTimes(1);
    expect(responseBody.errorMessage).toContain("Email already in use");
  });
  it("should return 400 BAD REQUEST response if email is not present in request", async () => {
    isUserEmailTaken.mockResolvedValueOnce(false);
    validateGenerateOtpInput.mockReturnValueOnce({
      success: false,
      message: "email field cannot be empty",
    });
    // request with no email in body
    const req = httpMocks.createRequest({
      method: "POST",
      url: "/api/signup/createOtp",
      body: {},
    });
    const res = httpMocks.createResponse();
    await createOtpHandler(req, res);
    expect(res.statusCode).toEqual(400);
    const responseBody = JSON.parse(res._getData());
    expect(responseBody.success).toBe(false);
    expect(validateGenerateOtpInput).toBeCalledTimes(1);
    expect(isUserEmailTaken).toBeCalledTimes(0);
    expect(responseBody.errorMessage).toContain("email field cannot be empty");
  });
  it("should return 400 response when request is invalid", async () => {
    isUserEmailTaken.mockResolvedValueOnce(false);
    // mock return value of validation function to be false
    validateGenerateOtpInput.mockReturnValueOnce({
      success: false,
      message: "Validation Error",
    });
    sendOtpEmail.mockResolvedValueOnce({ success: true });
    const req = httpMocks.createRequest({
      method: "POST",
      url: "/api/signup/createOtp",
      body: { email: "email" },
    });
    const res = httpMocks.createResponse();
    await createOtpHandler(req, res);
    expect(res.statusCode).toEqual(400);
    const responseBody = JSON.parse(res._getData());
    expect(responseBody.success).toBe(false);
    // this method should not be called as handler will return from validation step itself
    expect(isUserEmailTaken).toBeCalledTimes(0);
    expect(validateGenerateOtpInput).toBeCalledTimes(1);
    expect(sendOtpEmail).toBeCalledTimes(0);
    // check if validation error message from mocked method is seen in response
    expect(responseBody.errorMessage).toContain("Validation Error");
  });
  it("should return success response when it recieves a valid request with email", async () => {
    isUserEmailTaken.mockResolvedValueOnce(false);
    // mock return value of validation function to be false
    validateGenerateOtpInput.mockReturnValueOnce({
      success: true,
    });
    createOtp.mockResolvedValueOnce({ _id: 1 });
    sendOtpEmail.mockResolvedValueOnce({ success: true });
    const req = httpMocks.createRequest({
      method: "POST",
      url: "/api/signup/createOtp",
      body: { email: "email@gmail.com" },
    });
    const res = httpMocks.createResponse();
    await createOtpHandler(req, res);
    expect(res.statusCode).toEqual(201);
    const responseBody = JSON.parse(res._getData());
    expect(responseBody.success).toBe(true);
    // should contain the response with id  = 1
    expect(responseBody.data.id).toEqual(1);
    // this method should not be called as handler will return from validation step itself
    expect(isUserEmailTaken).toBeCalledTimes(1);

    // createOtp method should be called
    expect(createOtp).toBeCalledTimes(1);
    expect(createOtp).toBeCalledWith("email@gmail.com");
    expect(validateGenerateOtpInput).toBeCalledTimes(1);
    expect(sendOtpEmail).toBeCalledTimes(1);
  });

  it("should return 500 response when there is any Error thrown while creating otp", async () => {
    isUserEmailTaken.mockResolvedValueOnce(false);
    // mock return value of validation function to be false
    validateGenerateOtpInput.mockReturnValueOnce({
      success: true,
    });
    createOtp.mockImplementation(() => {
      throw new Error("error creating otp in database");
    });
    sendOtpEmail.mockResolvedValueOnce({ success: true });
    const req = httpMocks.createRequest({
      method: "POST",
      url: "/api/signup/createOtp",
      body: { email: "email@gmail.com" },
    });
    const res = httpMocks.createResponse();
    await createOtpHandler(req, res);
    expect(res.statusCode).toEqual(500);
    const responseBody = JSON.parse(res._getData());
    expect(responseBody.success).toBe(false);
    // should contain the response with id  = 1
    // this method should not be called as handler will return from validation step itself
    expect(isUserEmailTaken).toBeCalledTimes(1);
    expect(validateGenerateOtpInput).toBeCalledTimes(1);
    // createOtp method should be called
    expect(createOtp).toBeCalledTimes(1);
    expect(createOtp).toBeCalledWith("email@gmail.com");
    expect(responseBody.errorMessage).toContain(
      "Unable to create an account in the database"
    );
    expect(sendOtpEmail).toBeCalledTimes(0);
  });
});
