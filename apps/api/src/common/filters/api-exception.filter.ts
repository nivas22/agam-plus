import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiError } from '../errors/api-error';

interface ErrorResponseBody {
  error: string;
  details?: any;
  timestamp: string;
}

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('ApiExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    this.logger.error(
      'API Error:',
      exception instanceof Error ? exception.stack : exception,
    );

    if (exception instanceof ApiError) {
      const body: ErrorResponseBody = {
        error: exception.message,
        timestamp: new Date().toISOString(),
      };
      if (exception.details) body.details = exception.details;
      response.status(exception.statusCode).json(body);
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      const message =
        typeof exceptionResponse === 'string'
          ? exceptionResponse
          : ((exceptionResponse as any).message ?? exception.message);
      const body: ErrorResponseBody = {
        error: Array.isArray(message) ? message.join(', ') : message,
        timestamp: new Date().toISOString(),
      };
      if (
        typeof exceptionResponse === 'object' &&
        (exceptionResponse as any).details
      ) {
        body.details = (exceptionResponse as any).details;
      }
      response.status(status).json(body);
      return;
    }

    const errorMessage =
      exception instanceof Error ? exception.message : 'Internal server error';
    response
      .status(500)
      .json({ error: errorMessage, timestamp: new Date().toISOString() });
  }
}
