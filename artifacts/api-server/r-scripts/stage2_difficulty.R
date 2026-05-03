user_lib <- Sys.getenv("R_LIBS_USER", unset = "~/.R/library")
.libPaths(c(user_lib, .libPaths()))

suppressPackageStartupMessages({
  library(jsonlite)
})

input_path <- Sys.getenv("R_INPUT_JSON")
output_path <- Sys.getenv("R_OUTPUT_JSON")
if (input_path == "" || output_path == "") stop("R_INPUT_JSON / R_OUTPUT_JSON not set")

input <- fromJSON(input_path, simplifyVector = TRUE)

trainX <- as.matrix(do.call(rbind, lapply(input$trainX, as.numeric)))
trainY <- as.numeric(input$trainY)
predictX <- as.matrix(do.call(rbind, lapply(input$predictX, as.numeric)))
algorithm <- input$algorithm
cvFolds <- as.integer(input$cvFolds)

if (nrow(trainX) < 5) stop("Need >=5 calibrated items.")
if (ncol(trainX) != ncol(predictX)) stop("Feature dim mismatch.")

cv_r2 <- function(predicted, observed) {
  ss_res <- sum((observed - predicted)^2)
  ss_tot <- sum((observed - mean(observed))^2)
  if (ss_tot == 0) return(NA_real_)
  1 - ss_res / ss_tot
}

train_glmnet <- function(X, y, newX, folds) {
  if (!requireNamespace("glmnet", quietly = TRUE)) stop("glmnet not installed")
  cv <- glmnet::cv.glmnet(X, y, nfolds = min(folds, length(y)), alpha = 0.5)
  pred <- as.numeric(predict(cv, newx = newX, s = "lambda.min"))
  cv_pred <- as.numeric(predict(cv, newx = X, s = "lambda.min"))
  list(pred = pred, r2 = cv_r2(cv_pred, y))
}

train_rf <- function(X, y, newX, folds) {
  if (!requireNamespace("randomForest", quietly = TRUE)) stop("randomForest not installed")
  rf <- randomForest::randomForest(x = X, y = y, ntree = 500)
  pred <- as.numeric(predict(rf, newdata = newX))
  oob_pred <- rf$predicted
  list(pred = pred, r2 = cv_r2(oob_pred, y))
}

result <- if (algorithm == "glmnet") {
  train_glmnet(trainX, trainY, predictX, cvFolds)
} else if (algorithm == "randomForest") {
  train_rf(trainX, trainY, predictX, cvFolds)
} else {
  a <- train_glmnet(trainX, trainY, predictX, cvFolds)
  b <- train_rf(trainX, trainY, predictX, cvFolds)
  list(
    pred = (a$pred + b$pred) / 2,
    r2 = mean(c(a$r2, b$r2), na.rm = TRUE)
  )
}

writeLines(toJSON(list(
  predictions = as.numeric(result$pred),
  cvR2 = if (is.na(result$r2)) NULL else result$r2
), auto_unbox = TRUE, na = "null"), output_path)
