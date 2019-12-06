import * as express from "express";
import { BigQueryModel, BigQueryModelConfig } from "../models/BigQueryModel";
import {
  BigQueryRequest,
  BigQueryRetrievalResult, JsonParsingError
} from "../types/BigQueryTypes";
import {
  CustomError,
  isError,
  isCustomError,
} from "../../utils/error";

const jsonParser = express.json({
  inflate: true,
  limit: "1kb",
  strict: true,
  type: "application/json"
});

/*
  API route handler
*/
export class BigQueryController {
  static readonly addRoute = (app: express.Application): void => {
    app.post(BigQueryRequest.Path,
      jsonParser,
      async (req: express.Request, res: express.Response, next: express.NextFunction) => {
        try {
          if (!BigQueryController.s_configSet) {
            const config = new BigQueryModelConfig();
            BigQueryModel.Config = config;
            BigQueryController.s_configSet = true;
          }

          const errInfo: JsonParsingError = undefined;
          const bqRequest = BigQueryRequest.fromJson(req.body, req.ip, true, errInfo);

          if (!bqRequest) {
            const err = new CustomError(400, BigQueryController.s_ErrMsgParams, true);
            err.unobscuredMessage = `Invalid request from ${req.ip} with hostname ${req.hostname} using path ${req.originalUrl}. `;
            errInfo && (err.unobscuredMessage += errInfo!.message);
            return next(err);
          }

          const model = BigQueryModel.Factory;
          await model.fetch(bqRequest);
          const data = model.Data;

          if (data instanceof Error) {
            if (isCustomError(data)) {
              return next(data as CustomError);
            }
            const error = new CustomError(500, BigQueryController.s_ErrMsgBigQuery, true, true);
            // Can only be set to "<no data>" if code is incorrectly modified
            error.unobscuredMessage = (data as Error).message ?? "<no data>";
            return next(error);
          } else {
            res.status(200).json(data as BigQueryRetrievalResult);
          }
        } catch (err) {
          if (isCustomError(err)) {
            return next(err);
          }
          const error = new CustomError(500, BigQueryController.s_ErrMsgBigQuery, true, true);
          const errMsg: string = isError(err) ? err.message : (
            "Exception: <" +
            Object.keys(err).map((key) => `${key}: ${err[key] ?? "no data"}`).join("\n") +
            ">"
          );
          error.unobscuredMessage = errMsg;
          return next(error);
        }
      });
  }

  /********************** private data ************************/

  private static s_configSet = false;
  private static readonly s_ErrMsgBigQuery = "Could not query the backend database. Please retry later. If the problem persists contact Support";
  private static readonly s_ErrMsgParams = "Invalid data retrieval parameter(s). Please notify Support";
}